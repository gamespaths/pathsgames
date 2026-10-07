// v0.42.0 — CloudFront Function (cloudfront-js-2.0, viewer request): 301 from the old domain to the canonical host.
// Rendered by Terraform templatefile (target_host, old_domain; cloudfront.tf); path and query string are kept.
var TARGET_HOST = '${target_host}';
var OLD_DOMAIN = '${old_domain}';

function queryString(querystring) {
    var parts = [];
    for (var key in querystring) {
        var entry = querystring[key];
        var values = entry.multiValue ? entry.multiValue : [entry];
        for (var i = 0; i < values.length; i++) {
            parts.push(values[i].value === '' ? key : key + '=' + values[i].value);
        }
    }
    return parts.length ? '?' + parts.join('&') : '';
}

function handler(event) {
    var request = event.request;
    var host = request.headers.host ? request.headers.host.value.toLowerCase() : '';
    if (host !== OLD_DOMAIN && host !== 'www.' + OLD_DOMAIN) {
        return request;
    }
    return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: {
            location: { value: 'https://' + TARGET_HOST + request.uri + queryString(request.querystring || {}) },
            'cache-control': { value: 'max-age=3600' }
        }
    };
}
