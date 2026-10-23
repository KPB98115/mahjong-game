export type ServiceWorkerRegistrationPort = {
  register(scriptUrl: string): Promise<unknown>;
};

export function registerServiceWorker(container: ServiceWorkerRegistrationPort | null): void {
  if (container == null) {
    return;
  }
  void container.register("/sw.js");
}
