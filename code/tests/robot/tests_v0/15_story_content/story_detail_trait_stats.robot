*** Settings ***
# ---------------------------------------------------------------------------
# story_detail_trait_stats.robot
#
# Validates the v0.19.6 trait stat columns exposed on the public API
# (`GET /api/stories/{uuid}`):
#
#   traits[].life, .energy, .sad, .dexterity, .intelligence, .constitution, .weight
#
# Each field is a signed integer delta applied to the character's matching
# statistic when the trait is selected. Seed data must populate at least one
# trait per story with a non-zero life or intelligence delta so the public
# contract is exercised end-to-end.
#
# Tags: stories, traits, trait-stats
# ---------------------------------------------------------------------------
Library    RequestsLibrary
Library    Collections
Resource   ../../resources/common.resource
Resource   ../../resources/stories.resource

Suite Setup    Create Public Session


*** Test Cases ***

Every Trait Exposes The Seven Stat Bonus Fields
    [Documentation]    Each trait in the response exposes life/energy/sad/dexterity/intelligence/constitution/weight as integers.
    [Tags]    stories    traits    trait-stats
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${traits}=    Set Variable    ${body}[traits]
    FOR    ${tr}    IN    @{traits}
        Dictionary Should Contain Key    ${tr}    life
        Dictionary Should Contain Key    ${tr}    energy
        Dictionary Should Contain Key    ${tr}    sad
        Dictionary Should Contain Key    ${tr}    dexterity
        Dictionary Should Contain Key    ${tr}    intelligence
        Dictionary Should Contain Key    ${tr}    constitution
        Dictionary Should Contain Key    ${tr}    weight
        Should Be True    isinstance($tr['life'], int)
        Should Be True    isinstance($tr['energy'], int)
        Should Be True    isinstance($tr['sad'], int)
        Should Be True    isinstance($tr['dexterity'], int)
        Should Be True    isinstance($tr['intelligence'], int)
        Should Be True    isinstance($tr['constitution'], int)
        Should Be True    isinstance($tr['weight'], int)
    END

At Least One Trait In Demo 1 Has A Non Zero Stat Bonus
    [Documentation]    Seed data must include at least one trait with a non-zero delta on any of the seven stats.
    [Tags]    stories    traits    trait-stats    seed
    ${response}=    Get Story By UUID    ${DEMO_1_UUID}
    ${body}=    Set Variable    ${response.json()}
    ${traits}=    Set Variable    ${body}[traits]
    ${has_bonus}=    Set Variable    ${False}
    FOR    ${tr}    IN    @{traits}
        ${total}=    Evaluate    abs($tr['life']) + abs($tr['energy']) + abs($tr['sad']) + abs($tr['dexterity']) + abs($tr['intelligence']) + abs($tr['constitution']) + abs($tr['weight'])
        IF    ${total} > 0
            ${has_bonus}=    Set Variable    ${True}
        END
    END
    Should Be True    ${has_bonus}    msg=At least one trait must define a non-zero stat bonus.

Demo 2 Story Also Exposes Trait Stat Fields
    [Documentation]    The second seed story exposes the same seven stat keys on each trait.
    [Tags]    stories    traits    trait-stats    seed
    ${response}=    Get Story By UUID    ${DEMO_2_UUID}
    Status Should Be    ${response}    200
    ${body}=    Set Variable    ${response.json()}
    ${traits}=    Set Variable    ${body}[traits]
    FOR    ${tr}    IN    @{traits}
        Dictionary Should Contain Key    ${tr}    life
        Dictionary Should Contain Key    ${tr}    energy
        Dictionary Should Contain Key    ${tr}    sad
        Dictionary Should Contain Key    ${tr}    dexterity
        Dictionary Should Contain Key    ${tr}    intelligence
        Dictionary Should Contain Key    ${tr}    constitution
        Dictionary Should Contain Key    ${tr}    weight
    END
