import strawberry

from controllers.graphql.resolvers.support_resolvers import SupportQuery, SupportMutation

schema = strawberry.Schema(
    query=SupportQuery,
    mutation=SupportMutation,
)
