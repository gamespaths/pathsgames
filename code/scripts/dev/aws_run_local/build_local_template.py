#!/usr/bin/env python3
"""build_local_template.py - v0.41.4 turns the `sam build` output (nested stacks, raw ApiGatewayV2 routes)
into two flat templates `sam local start-api` serves: local-public.yaml and local-admin.yaml (IP authorizer)."""
import argparse
import sys
from pathlib import Path

import yaml

FUNCTION_KEYS = ("Runtime", "Handler", "Timeout", "MemorySize")


def _load(path):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))


def _resolve(value, mapping):
    """A nested-stack value rewritten for the root: Ref to a module parameter → the root expression."""
    if isinstance(value, dict) and set(value) == {"Ref"} and value["Ref"] in mapping:
        return mapping[value["Ref"]]
    if isinstance(value, dict):
        return {k: _resolve(v, mapping) for k, v in value.items()}
    if isinstance(value, list):
        return [_resolve(v, mapping) for v in value]
    return value


def _function(props, code_uri, mapping, arch):
    out = {k: props[k] for k in FUNCTION_KEYS if k in props}
    out["CodeUri"] = code_uri
    out["Architectures"] = [arch]
    variables = _resolve(((props.get("Environment") or {}).get("Variables")) or {}, mapping)
    # Every boto3 client goes to a local container (S3 to moto, the rest to DynamoDB Local): nothing
    # reaches the real AWS account.
    variables["AWS_ENDPOINT_URL"] = {"Ref": "LocalAwsEndpoint"}
    variables["AWS_ENDPOINT_URL_S3"] = {"Ref": "LocalS3Endpoint"}
    out["Environment"] = {"Variables": variables}
    return out


def collect(build_dir, arch):
    """Functions and routes of the whole build: ({logical id: function}, [(api, method, path, fn, custom)])."""
    root = _load(build_dir / "template.yaml")
    resources = root["Resources"]
    table = resources["PathsGamesTable"]["Properties"]["TableName"]
    functions, routes = {}, []
    for logical_id, res in resources.items():
        if res.get("Type") == "AWS::Serverless::Function":
            props = res["Properties"]
            functions[logical_id] = _function(props, props["CodeUri"], {}, arch)
    for module_id, res in resources.items():
        if res.get("Type") != "AWS::Serverless::Application":
            continue
        location = Path(res["Properties"]["Location"])
        params = res["Properties"].get("Parameters") or {}
        # Module parameter → root expression; the table is a resource, so its name is spelled out.
        mapping = {name: ({"Fn::Sub": table["Fn::Sub"]} if value == {"Ref": "PathsGamesTable"} else value)
                   for name, value in params.items()}
        module = _load(build_dir / location)["Resources"]
        for logical_id, item in module.items():
            if item.get("Type") == "AWS::Serverless::Function":
                code_uri = str(location.parent / item["Properties"]["CodeUri"])
                functions[logical_id] = _function(item["Properties"], code_uri, mapping, arch)
        for logical_id, item in module.items():
            if item.get("Type") != "AWS::ApiGatewayV2::Route":
                continue
            props = item["Properties"]
            integration_id = props["Target"]["Fn::Sub"].split("${")[1].rstrip("}")
            function_id = module[integration_id]["Properties"]["IntegrationUri"]["Fn::GetAtt"][0]
            api = "admin" if props["ApiId"] == {"Ref": "AdminApiId"} else "public"
            method, path = props["RouteKey"].split(" ", 1)
            routes.append((api, method, path, function_id, props.get("AuthorizationType") == "CUSTOM",
                           f"{module_id}{logical_id}"))
    return root.get("Parameters") or {}, functions, routes


def flat_template(parameters, functions, routes, api):
    """One SAM template serving only the routes of `api` (public or admin) on a Serverless::HttpApi."""
    api_props = {}
    if api == "admin":
        api_props["Auth"] = {
            "Authorizers": {"AdminIpAuthorizer": {
                "FunctionArn": {"Fn::GetAtt": ["AdminIpAuthorizerFunction", "Arn"]},
                # SAM local needs an identity source; Host is on every request.
                "Identity": {"Headers": ["Host"]},
                "AuthorizerPayloadFormatVersion": "2.0",
                "EnableSimpleResponses": True}},
            "DefaultAuthorizer": "AdminIpAuthorizer"}
    resources = {"LocalApi": {"Type": "AWS::Serverless::HttpApi", "Properties": api_props}}
    for fn_api, method, path, function_id, custom, event_id in routes:
        if fn_api != api:
            continue
        fn = resources.setdefault(function_id, {"Type": "AWS::Serverless::Function",
                                                "Properties": dict(functions[function_id])})
        event = {"ApiId": {"Ref": "LocalApi"}, "Method": method, "Path": path}
        if api == "admin" and not custom:
            event["Auth"] = {"Authorizer": "NONE"}
        fn["Properties"].setdefault("Events", {})[event_id] = {"Type": "HttpApi", "Properties": event}
    if api == "admin":
        resources["AdminIpAuthorizerFunction"] = {"Type": "AWS::Serverless::Function",
                                                  "Properties": functions["AdminIpAuthorizerFunction"]}
    parameters = dict(parameters, LocalAwsEndpoint={
        "Type": "String", "Default": "http://pathsgames-aws-local-dynamodb:8000",
        "Description": "AWS_ENDPOINT_URL of every function (DynamoDB Local on the docker network)."},
        LocalS3Endpoint={
            "Type": "String", "Default": "http://pathsgames-aws-local-s3:5000",
            "Description": "AWS_ENDPOINT_URL_S3 of every function (moto S3 server on the docker network)."})
    return {"AWSTemplateFormatVersion": "2010-09-09", "Transform": "AWS::Serverless-2016-10-31",
            "Description": f"Paths Games - local {api} API (generated, do not edit)",
            "Parameters": parameters, "Resources": resources}


def main():
    parser = argparse.ArgumentParser(description="Flatten a sam build directory for sam local start-api.")
    parser.add_argument("build_dir")
    parser.add_argument("--arch", default="x86_64", choices=["x86_64", "arm64"])
    args = parser.parse_args()
    build_dir = Path(args.build_dir)
    parameters, functions, routes = collect(build_dir, args.arch)
    for api in ("public", "admin"):
        doc = flat_template(parameters, functions, routes, api)
        path = build_dir / f"local-{api}.yaml"
        path.write_text(yaml.safe_dump(doc, sort_keys=False), encoding="utf-8")
        count = sum(1 for r in routes if r[0] == api)
        print(f"{path.name}: {count} route(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
