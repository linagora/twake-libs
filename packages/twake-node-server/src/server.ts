import Fastify, {
  LogController,
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerOptions
} from 'fastify'

export interface ServerOptions {
  logger: FastifyBaseLogger
  isReady: () => Promise<boolean>
  isAlive?: () => boolean
  fastify?: Omit<
    FastifyServerOptions,
    'logger' | 'loggerInstance' | 'logController'
  >
}

// The query string can carry search terms and the links people share.
const pathOf = (request: FastifyRequest): string =>
  request.url.replace(/\?.*/s, '')

class PathOnlyLogController extends LogController {
  override routeNotFound(request: FastifyRequest): void {
    if (this.isLogDisabled(request)) return
    request.log.info(`Route ${request.method}:${pathOf(request)} not found`)
  }
}

export function createServer(options: ServerOptions): FastifyInstance {
  const app = Fastify({
    ...options.fastify,
    loggerInstance: options.logger.child(
      {},
      {
        serializers: {
          req: (request: FastifyRequest) => ({
            method: request.method,
            url: pathOf(request),
            host: request.host,
            remoteAddress: request.ip
          })
        }
      }
    ),
    logController: new PathOnlyLogController({
      disableRequestLogging: (request): boolean =>
        request.url.startsWith('/health/')
    })
  })

  // Fastify answers with the error's message, which for a failed query holds
  // its SQL and parameters.
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const status =
      error.statusCode !== undefined && error.statusCode >= 400
        ? error.statusCode
        : 500
    if (status < 500) return reply.send(error)
    reply.log.error({ req: request, err: error }, error.message)
    return reply.code(status).send({ error: 'server_error' })
  })

  app.get('/health/live', (_request, reply) => {
    const alive = options.isAlive?.() ?? true
    return reply
      .code(alive ? 200 : 503)
      .send({ status: alive ? 'ok' : 'unavailable' })
  })

  app.get('/health/ready', async (_request, reply) => {
    const ready = await options.isReady().catch(() => false)
    return reply
      .code(ready ? 200 : 503)
      .send({ status: ready ? 'ok' : 'unavailable' })
  })

  return app
}
