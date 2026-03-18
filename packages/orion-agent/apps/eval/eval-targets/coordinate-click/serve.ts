const server = Bun.serve({
  port: 3100,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname === '/' ? '/index.html' : url.pathname
    const file = Bun.file(import.meta.dir + path)

    if (await file.exists()) {
      return new Response(file)
    }

    return new Response('Not Found', { status: 404 })
  },
})

console.log(`Coordinate click test running at http://localhost:${server.port}`)
