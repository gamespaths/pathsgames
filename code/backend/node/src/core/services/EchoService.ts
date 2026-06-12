export class EchoService {
  getServerStatus(): string {
    return 'OK';
  }

  getTimestamp(): number {
    return Date.now();
  }

  getServerProperties(): Record<string, string> {
    return {
      status: 'OK',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
