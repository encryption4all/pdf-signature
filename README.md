# pdf-signature

> For full documentation, visit [docs.postguard.eu](https://docs.postguard.eu/repos/pdf-signature).

PDF signing and signature verification utility using identity-based signatures. Extends PostGuard's identity-based cryptography to PDF document signing. The project has a Rust backend and a TypeScript/React frontend, structured similarly to Cryptify.

## Development

The easiest way to get a development setup running is with Docker:

```bash
docker-compose -f docker-compose.dev.yml up
```

For a production-like setup:

```bash
docker-compose up
```

To run services manually without Docker: the backend requires a Rust toolchain, and the frontend requires Node.js. See the `cryptify-back-end/` and `cryptify-front-end/` directories for their respective build instructions.

## Releasing

No automated releases.

## License

MIT
