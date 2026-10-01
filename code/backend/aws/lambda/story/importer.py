"""v0.41.4 Step 41 H — the story import as a function, called by the story route and by the match import
(both functions ship ``CodeUri: ../lambda/``). Answers the same API Gateway response the route answers."""


def import_story_data(data):
    """Validate and store one story import JSON; a 201 response, or the 400 the route would answer."""
    from story import handler
    return handler.import_story_data(data)
