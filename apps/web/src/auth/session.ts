import axios from 'axios';
import { shallowRef } from 'vue';
import { getAccountSession, type AccountUser } from '../api/auth';

export const currentAccount = shallowRef<AccountUser | null>(null);
let sessionResolved = false;
let sessionRequest: Promise<AccountUser | null> | undefined;

export function setCurrentAccount(user: AccountUser): void {
  currentAccount.value = user;
  sessionResolved = true;
}

export function clearCurrentAccount(): void {
  currentAccount.value = null;
  sessionResolved = true;
}

export async function ensureAccountSession(): Promise<AccountUser | null> {
  if (currentAccount.value) return currentAccount.value;
  if (sessionResolved) return null;
  if (!sessionRequest) {
    sessionRequest = getAccountSession()
      .then((user) => {
        setCurrentAccount(user);
        return user;
      })
      .catch((error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          clearCurrentAccount();
          return null;
        }
        throw error;
      })
      .finally(() => {
        sessionRequest = undefined;
      });
  }
  return sessionRequest;
}

export function resetAccountSessionForTests(): void {
  currentAccount.value = null;
  sessionResolved = false;
  sessionRequest = undefined;
}
