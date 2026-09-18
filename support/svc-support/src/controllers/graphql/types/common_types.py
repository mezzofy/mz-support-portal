import strawberry

JSON = strawberry.scalar(
    str,
    name="JSON",
    serialize=lambda v: v,
    parse_value=lambda v: v,
    description="JSON scalar for arbitrary JSON data",
)


@strawberry.type
class MessageResponse:
    message: str
