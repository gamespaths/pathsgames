*** Settings ***
# policy_pages.robot — v1.2.0 V1 step 2 (§3.0): the static policy pages built at postbuild answer 200 on the
# deployed site (Google Auth Platform Branding points to them). Skipped unless WEBSITE_URL is given
# (e.g. --variable WEBSITE_URL:https://paths.games).
Library    RequestsLibrary
Resource   ../../resources/common.resource
Force Tags        v1_step02    website

*** Variables ***
${WEBSITE_URL}    ${EMPTY}

*** Test Cases ***

Privacy Terms And Cookies Pages Answer 200
    Skip If    '${WEBSITE_URL}' == ''    WEBSITE_URL not given: the deployed site is not checked
    Create Http Session    website    ${WEBSITE_URL}    verify=true
    FOR    ${page}    IN    privacy.html    terms.html    cookies.html
        ${resp}=    GET On Session    website    /${page}    expected_status=200
        Should Contain    ${resp.text}    https://paths.games/${page}
    END
