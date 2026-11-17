/** Script-tag build: `<script src=".../fintivio-client.js"></script>` then `FintivioClient.mount(...)`. */
import { createClient, mount } from './index';

(globalThis as unknown as { FintivioClient: unknown }).FintivioClient = { mount, createClient };
