declare module 'dmn-js' {
  interface DmnJSOptions {
    container: HTMLElement;
    keyboard?: {
      bindTo: Document;
    };
  }

  interface SaveXMLOptions {
    format?: boolean;
  }

  interface SaveXMLResult {
    xml: string;
  }

  export default class DmnJS {
    constructor(options: DmnJSOptions);
    importXML(xml: string): Promise<void>;
    saveXML(options?: SaveXMLOptions): Promise<SaveXMLResult>;
    destroy(): void;
  }
} 