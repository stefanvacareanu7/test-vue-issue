import {APIGatewayProxyEvent, Context} from 'aws-lambda'
import createAPI, {Request, Response} from 'lambda-api'
import migrateApi from './migrate/MigrateApi'
import tablesApi from './tables/TablesApi'
import usersApi from './users/UsersApi'
import rolesApi from './roles/RolesApi'
import graphApi from './graph/GraphApi'
import {RtmiException} from './util/Exception'

const api = createAPI()

api.get('/v1', (): object => {
    return {ping: 'pong'}
})

api.use((error: Error, request:Request, response:Response, next: () => void) => {
    if(error instanceof RtmiException) {
        response.status(error.statusCode).send(error.message)
    }
    next()
})

api.register(migrateApi, { prefix: '/v1'})
api.register(tablesApi, { prefix: '/v1'})
api.register(usersApi, {prefix: '/v1'})
api.register(rolesApi, {prefix: '/v1'})
api.register(graphApi, {prefix: '/v1'})

type LambdaResponse = {
    body: string
Minor icon MINOR
Code Style
Unexpected any. Specify a different type.
    headers: { [key: string]: any }
    statusCode: number
}

export const handler = async function(event: APIGatewayProxyEvent, context:Context): Promise<LambdaResponse> {
    console.log('Processing request:', JSON.stringify(event, undefined, 2))
    // eslint-disable-next-line
    return await api.run(event, context)
}
