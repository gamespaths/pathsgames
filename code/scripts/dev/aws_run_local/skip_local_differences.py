"""skip_local_differences.py - v0.41.4 Robot pre-run modifier of the local AWS run: skips the tests that
depend on API Gateway behaviour `sam local` does not reproduce, each with its reason in the report."""
from robot.api import SuiteVisitor

# Test name → why sam local differs from the deployed API Gateway.
LOCAL_DIFFERENCES = {
    "An Unauthenticated Caller Is Refused Before Anything Is Looked Up":
        "sam local keeps the trailing space of 'Authorization: Bearer ' (EMPTY_TOKEN); "
        "API Gateway trims it (MISSING_TOKEN)",
}


class skip_local_differences(SuiteVisitor):

    def start_test(self, test):
        reason = LOCAL_DIFFERENCES.get(test.name)
        if reason:
            test.tags.add("robot:skip")
            test.doc = f"{test.doc}\n\nSkipped on the local AWS run: {reason}."
