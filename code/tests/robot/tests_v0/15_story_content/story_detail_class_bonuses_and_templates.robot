*** Settings ***
# ---------------------------------------------------------------------------
# story_detail_class_bonuses_and_templates.robot
#
# Validates the new public-API fields:
#   - classes[].bonuses[] (rows from list_classes_bonus exposed nested in each class)
#   - characterTemplates[].idClassPermitted / .idClassProhibited
#
# Each bonus entry has shape { uuid?, statistic, value } where:
#   - statistic is a non-empty string
#   - value is an integer
#
# Tags: stories, class-bonuses, character-templates
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Each Class Has A Bonuses List Field
    [Documentation]    Every class object in the story detail exposes a bonuses field that is a list.
    [Tags]    stories    class-bonuses
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${classes}=    Set Variable    ${body}[classes]
    FOR    ${cls}    IN    @{classes}
        Dictionary Should Contain Key    ${cls}    bonuses
        ${type}=    Evaluate    type($cls['bonuses']).__name__
        Should Be Equal    ${type}    list
    END

Class Bonus Entries Have Required Fields
    [Documentation]    If any class has bonuses, each bonus has statistic (string) and value (int).
    [Tags]    stories    class-bonuses
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${classes}=    Set Variable    ${body}[classes]
    FOR    ${cls}    IN    @{classes}
        FOR    ${b}    IN    @{cls}[bonuses]
            Dictionary Should Contain Key    ${b}    statistic
            Dictionary Should Contain Key    ${b}    value
            Should Be True    isinstance($b['statistic'], str) and len($b['statistic']) > 0
            Should Be True    isinstance($b['value'], int)
        END
    END

At Least One Class In Demo 1 Has Bonuses
    [Documentation]    Seed data should provide at least one class with at least one bonus row.
    [Tags]    stories    class-bonuses    seed
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${classes}=    Set Variable    ${body}[classes]
    ${total_bonuses}=    Set Variable    ${0}
    FOR    ${cls}    IN    @{classes}
        ${count}=    Get Length    ${cls}[bonuses]
        ${total_bonuses}=    Evaluate    ${total_bonuses} + ${count}
    END
    Should Be True    ${total_bonuses} > 0    msg=Seed data must include at least one class bonus.

Character Templates Expose idClassPermitted And idClassProhibited
    [Documentation]    Every character template object exposes idClassPermitted and idClassProhibited keys (nullable integers).
    [Tags]    stories    character-templates
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${templates}=    Set Variable    ${body}[characterTemplates]
    FOR    ${ct}    IN    @{templates}
        Dictionary Should Contain Key    ${ct}    idClassPermitted
        Dictionary Should Contain Key    ${ct}    idClassProhibited
        ${permitted}=    Set Variable    ${ct}[idClassPermitted]
        ${prohibited}=   Set Variable    ${ct}[idClassProhibited]
        Should Be True    ($permitted is None) or isinstance($permitted, int)
        Should Be True    ($prohibited is None) or isinstance($prohibited, int)
    END

Demo 2 Story Also Exposes The New Fields
    [Documentation]    The second seed story also returns class.bonuses and template class FK fields.
    [Tags]    stories    class-bonuses    character-templates    seed
    ${response}=    Get Story By UUID    ${DEMO_2_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    ${classes}=    Set Variable    ${body}[classes]
    FOR    ${cls}    IN    @{classes}
        Dictionary Should Contain Key    ${cls}    bonuses
    END
    ${templates}=    Set Variable    ${body}[characterTemplates]
    FOR    ${ct}    IN    @{templates}
        Dictionary Should Contain Key    ${ct}    idClassPermitted
        Dictionary Should Contain Key    ${ct}    idClassProhibited
    END
