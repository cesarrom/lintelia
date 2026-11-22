/** Script-tag build: `<script src=".../lintelia-client.js"></script>` then `LinteliaClient.mount(...)`. */
import { createClient, mount } from './index';

(globalThis as unknown as { LinteliaClient: unknown }).LinteliaClient = { mount, createClient };
