// Precisa ser escrito literalmente assim para o Next embutir o valor no bundle do navegador.
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Endereço do simulador. Função (e não constante) para o erro só acontecer quando alguém usar.
export function getApiUrl(): string {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL não está definida (veja apps/web/.env.example)');
  }
  return API_URL;
}
