"""Story editor — metadata + full CRUD over all 22 sub-entities, plus
inline fast-create of cards and texts (modal, no page change)."""
from flask import (Blueprint, abort, flash, jsonify, redirect,
                   render_template, request, url_for)

from .. import api
from ..api import ApiError
from ..auth import login_required
from ..entities import (ENTITY_TYPES, STORIES_ENTITIES_COLUMNS,
                        STORIES_ENTITIES_FIELDS, STORIES_ENTITIES_TABS)
from ..forms import build_payload

bp = Blueprint("editor", __name__, url_prefix="/stories")

_TEXT_COLUMN_TYPES = {"idTextName", "idTextDescription", "idTextTitle"}


def _text_map(uuid):
    """Build {idText: shortText} (en preferred) for resolving id columns."""
    try:
        texts = api.list_entities(uuid, "texts") or []
    except ApiError:
        return {}
    out = {}
    for t in texts:
        tid = t.get("idText")
        if tid is None:
            continue
        if tid not in out or t.get("lang") == "en":
            out[tid] = t.get("shortText") or t.get("longText") or ""
    return out


@bp.route("/<uuid>/edit", endpoint="edit")
@login_required
def edit(uuid):
    active_tab = request.args.get("tab", "metadata")
    if active_tab != "metadata" and active_tab not in ENTITY_TYPES:
        active_tab = "metadata"

    try:
        story = api.get_story(uuid)
    except ApiError as e:
        flash(e.message, "danger")
        return redirect(url_for("stories.index"))
    if not story:
        abort(404)

    rows, columns, fields, text_map = [], [], [], {}
    edit_uuid = request.args.get("edit")
    edit_row = None
    if active_tab != "metadata":
        columns = STORIES_ENTITIES_COLUMNS.get(active_tab, [])
        fields = STORIES_ENTITIES_FIELDS.get(active_tab, [])
        try:
            rows = api.list_entities(uuid, active_tab) or []
        except ApiError as e:
            flash(e.message, "danger")
        if any(c.get("type") in _TEXT_COLUMN_TYPES for c in columns):
            text_map = _text_map(uuid)
        if edit_uuid:
            edit_row = next((r for r in rows if r.get("uuid") == edit_uuid), None)

    return render_template(
        "story/editor.html",
        story=story, uuid=uuid, tabs=STORIES_ENTITIES_TABS, active_tab=active_tab,
        rows=rows, columns=columns, fields=fields, text_map=text_map,
        text_column_types=_TEXT_COLUMN_TYPES, edit_uuid=edit_uuid, edit_row=edit_row,
        card_fields=STORIES_ENTITIES_FIELDS["cards"], text_fields=STORIES_ENTITIES_FIELDS["texts"],
    )


@bp.route("/<uuid>/update", methods=["POST"], endpoint="update_story")
@login_required
def update_story(uuid):
    payload = {
        "author": (request.form.get("author") or "").strip() or None,
        "category": (request.form.get("category") or "").strip() or None,
        "group": (request.form.get("group") or "").strip() or None,
        "visibility": (request.form.get("visibility") or "PUBLIC").strip(),
        "priority": request.form.get("priority", type=int),
    }
    try:
        api.update_story(uuid, payload)
        flash("Story updated.", "success")
    except ApiError as e:
        flash(e.message, "danger")
    return redirect(url_for("editor.edit", uuid=uuid, tab="metadata"))


def _check_type(entity_type):
    if entity_type not in ENTITY_TYPES:
        abort(404)


@bp.route("/<uuid>/entities/<entity_type>/create", methods=["POST"], endpoint="create_entity")
@login_required
def create_entity(uuid, entity_type):
    _check_type(entity_type)
    try:
        api.create_entity(uuid, entity_type, build_payload(entity_type, request.form))
        flash(f"{entity_type} created.", "success")
    except ApiError as e:
        flash(e.message, "danger")
    return redirect(url_for("editor.edit", uuid=uuid, tab=entity_type))


@bp.route("/<uuid>/entities/<entity_type>/<euuid>/update", methods=["POST"], endpoint="update_entity")
@login_required
def update_entity(uuid, entity_type, euuid):
    _check_type(entity_type)
    try:
        api.update_entity(uuid, entity_type, euuid, build_payload(entity_type, request.form))
        flash(f"{entity_type} updated.", "success")
    except ApiError as e:
        flash(e.message, "danger")
    return redirect(url_for("editor.edit", uuid=uuid, tab=entity_type))


@bp.route("/<uuid>/entities/<entity_type>/<euuid>/delete", methods=["POST"], endpoint="delete_entity")
@login_required
def delete_entity(uuid, entity_type, euuid):
    _check_type(entity_type)
    try:
        api.delete_entity(uuid, entity_type, euuid)
        flash(f"{entity_type} deleted.", "success")
    except ApiError as e:
        flash(e.message, "danger")
    return redirect(url_for("editor.edit", uuid=uuid, tab=entity_type))


@bp.route("/<uuid>/validate", endpoint="validate")
@login_required
def validate(uuid):
    result = None
    try:
        result = api.validate_story(uuid)
    except ApiError as e:
        flash(e.message, "danger")
    return render_template("story/validate.html", uuid=uuid, result=result)


# ── Fast inline creators (called by the modal via fetch; return JSON) ──
@bp.route("/<uuid>/fast/card", methods=["POST"], endpoint="fast_card")
@login_required
def fast_card(uuid):
    try:
        created = api.create_entity(uuid, "cards", build_payload("cards", request.form)) or {}
        return jsonify({"ok": True, "id": created.get("id") or created.get("idCard"),
                        "uuid": created.get("uuid")})
    except ApiError as e:
        return jsonify({"ok": False, "error": e.message}), 400


@bp.route("/<uuid>/fast/text", methods=["POST"], endpoint="fast_text")
@login_required
def fast_text(uuid):
    try:
        created = api.create_entity(uuid, "texts", build_payload("texts", request.form)) or {}
        return jsonify({"ok": True, "id": created.get("idText") or created.get("id"),
                        "uuid": created.get("uuid")})
    except ApiError as e:
        return jsonify({"ok": False, "error": e.message}), 400
