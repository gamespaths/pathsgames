"""Step21Helper — pure-python helpers for the Step 21 character-selection suite.

The suite resolves its loadout dynamically from a public story's detail (seed
uuids are auto-generated). These helpers search the detail JSON for the
template/class combinations a scenario needs and return ``''``-friendly values
so the suite can skip a scenario when the running backend's seed does not
express it.
"""


def find_incompatible_template_class(detail):
    """Find a (templateUuid, classUuid) pair that must fail the class-compatibility
    check on join (Step 21):

      - a template whose idClassPermitted is set, paired with a class whose id is
        different (permitted-mismatch), OR
      - a template whose idClassProhibited is set, paired with the class whose id
        equals it (prohibited-match).

    Returns ('', '') when the seed has no class-restricted template.
    """
    templates = detail.get("characterTemplates") or []
    classes = detail.get("classes") or []
    if not classes:
        return "", ""
    class_by_id = {c.get("id"): c for c in classes if c.get("id") is not None}

    for tpl in templates:
        tpl_uuid = tpl.get("uuid")
        if not tpl_uuid:
            continue
        permitted = tpl.get("idClassPermitted")
        prohibited = tpl.get("idClassProhibited")
        if permitted is not None:
            # any class whose id differs from the permitted one is incompatible
            for c in classes:
                if c.get("uuid") and c.get("id") != int(permitted):
                    return tpl_uuid, c.get("uuid")
        if prohibited is not None:
            prohibited_class = class_by_id.get(int(prohibited))
            if prohibited_class and prohibited_class.get("uuid"):
                return tpl_uuid, prohibited_class.get("uuid")
    return "", ""
