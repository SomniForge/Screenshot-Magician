import {
  EDITOR_SESSION_RECORD_ID,
  EDITOR_SESSION_STORE_NAME,
  PROJECTS_DB_NAME,
  PROJECTS_DB_VERSION,
  PROJECTS_STORE_NAME
} from './constants';
import type { PersistedEditorSession, PersistedEditorSessionRecord, ProjectRecord } from './types';

const openProjectsDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(PROJECTS_DB_NAME, PROJECTS_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
        db.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(EDITOR_SESSION_STORE_NAME)) {
        db.createObjectStore(EDITOR_SESSION_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const getProjectStore = async (mode: IDBTransactionMode) => {
  const db = await openProjectsDb();
  const transaction = db.transaction(PROJECTS_STORE_NAME, mode);
  const store = transaction.objectStore(PROJECTS_STORE_NAME);
  return { db, transaction, store };
};

const getEditorSessionStore = async (mode: IDBTransactionMode) => {
  const db = await openProjectsDb();
  const transaction = db.transaction(EDITOR_SESSION_STORE_NAME, mode);
  const store = transaction.objectStore(EDITOR_SESSION_STORE_NAME);
  return { db, transaction, store };
};

export const listStoredProjects = async () =>
  new Promise<ProjectRecord[]>(async (resolve, reject) => {
    try {
      const { db, transaction, store } = await getProjectStore('readonly');
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        resolve((request.result as ProjectRecord[]).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      reject(error);
    }
  });

export const saveStoredProject = async (project: ProjectRecord) =>
  new Promise<void>(async (resolve, reject) => {
    try {
      const { db, transaction, store } = await getProjectStore('readwrite');
      const request = store.put(project);

      request.onsuccess = () => {
        db.close();
        resolve();
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      reject(error);
    }
  });

export const loadStoredProject = async (projectId: string) =>
  new Promise<ProjectRecord | undefined>(async (resolve, reject) => {
    try {
      const { db, transaction, store } = await getProjectStore('readonly');
      const request = store.get(projectId);

      request.onsuccess = () => {
        db.close();
        resolve(request.result as ProjectRecord | undefined);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      reject(error);
    }
  });

export const deleteStoredProject = async (projectId: string) =>
  new Promise<void>(async (resolve, reject) => {
    try {
      const { db, transaction, store } = await getProjectStore('readwrite');
      const request = store.delete(projectId);

      request.onsuccess = () => {
        db.close();
        resolve();
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      reject(error);
    }
  });

export const saveEditorSessionRecord = async (state: PersistedEditorSession) => {
  const record: PersistedEditorSessionRecord = {
    id: EDITOR_SESSION_RECORD_ID,
    state,
    updatedAt: new Date().toISOString()
  };

  const { db, transaction, store } = await getEditorSessionStore('readwrite');

  await new Promise<void>((resolve, reject) => {
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

export const loadEditorSessionRecord = async () =>
  new Promise<PersistedEditorSessionRecord | undefined>(async (resolve, reject) => {
    try {
      const { db, transaction, store } = await getEditorSessionStore('readonly');
      const request = store.get(EDITOR_SESSION_RECORD_ID);

      request.onsuccess = () => resolve(request.result as PersistedEditorSessionRecord | undefined);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    } catch (error) {
      reject(error);
    }
  });
