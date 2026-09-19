let tokenProvider: () => Promise<string | null> = async () => null;
let workspaceId: string | null = null;

export function configureTokenProvider(provider: () => Promise<string | null>) {
  tokenProvider = provider;
}

export function accessToken() {
  return tokenProvider();
}

export function setActiveWorkspace(id: string | null) {
  workspaceId = id;
}

export function activeWorkspace() {
  return workspaceId;
}
