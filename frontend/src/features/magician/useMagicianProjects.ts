import type { ComputedRef, Ref } from 'vue';
import type { AnalyticsParams } from '@/composables/useAnalytics';
import { deleteStoredProject, listStoredProjects, loadStoredProject, saveStoredProject } from './storage';
import type { PendingEditorAction, ProjectRecord, SaveProjectOptions } from './types';

interface UseMagicianProjectsOptions {
  autosaveState: Ref<'idle' | 'pending' | 'saving' | 'saved' | 'error'>;
  closePendingEditorAction: () => void;
  createEditorSnapshot: () => ProjectRecord['snapshot'];
  createProjectId: () => string;
  currentProjectId: Ref<string | null>;
  currentProjectName: Ref<string>;
  getAnalyticsContext: () => Record<string, unknown>;
  hasUnsavedChanges: ComputedRef<boolean>;
  isProjectsLoading: Ref<boolean>;
  markCurrentStateAsSaved: (snapshot?: ProjectRecord['snapshot']) => void;
  openNewSessionDialog: () => void;
  pendingEditorAction: Ref<PendingEditorAction | null>;
  pendingProjectDelete: Ref<{ id: string; name: string } | null>;
  pendingProjectName: Ref<string>;
  projectRecords: Ref<Array<Pick<ProjectRecord, 'id' | 'name' | 'createdAt' | 'updatedAt'>>>;
  resetSession: () => void;
  showDeleteProjectDialog: Ref<boolean>;
  showProjectsDialog: Ref<boolean>;
  showSaveProjectDialog: Ref<boolean>;
  showUnsavedChangesDialog: Ref<boolean>;
  toSerializableSnapshot: (snapshot: ProjectRecord['snapshot']) => ProjectRecord['snapshot'];
  trackEvent: (eventName: string, payload?: AnalyticsParams) => void;
  applyEditorSnapshot: (snapshot: Partial<ProjectRecord['snapshot']>) => void;
}

export const useMagicianProjects = (options: UseMagicianProjectsOptions) => {
  const {
    autosaveState,
    closePendingEditorAction,
    createEditorSnapshot,
    createProjectId,
    currentProjectId,
    currentProjectName,
    getAnalyticsContext,
    hasUnsavedChanges,
    isProjectsLoading,
    markCurrentStateAsSaved,
    openNewSessionDialog,
    pendingEditorAction,
    pendingProjectDelete,
    pendingProjectName,
    projectRecords,
    resetSession,
    showDeleteProjectDialog,
    showProjectsDialog,
    showSaveProjectDialog,
    showUnsavedChangesDialog,
    toSerializableSnapshot,
    trackEvent,
    applyEditorSnapshot
  } = options;

  const refreshProjectList = async () => {
    isProjectsLoading.value = true;

    try {
      const projects = await listStoredProjects();
      projectRecords.value = projects.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }));
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      isProjectsLoading.value = false;
    }
  };

  const openProjectsManager = async () => {
    showProjectsDialog.value = true;
    await refreshProjectList();
  };

  const closeSaveProjectDialog = () => {
    showSaveProjectDialog.value = false;
    pendingEditorAction.value = null;
  };

  const loadProject = async (projectId: string, options?: { bypassUnsavedCheck?: boolean }) => {
    if (!options?.bypassUnsavedCheck && hasUnsavedChanges.value) {
      pendingEditorAction.value = { type: 'load-project', projectId };
      showUnsavedChangesDialog.value = true;
      return;
    }

    try {
      const project = await loadStoredProject(projectId);
      if (!project) return;

      applyEditorSnapshot(project.snapshot);
      currentProjectId.value = project.id;
      currentProjectName.value = project.name;
      markCurrentStateAsSaved(project.snapshot);
      trackEvent('load_project', {
        ...getAnalyticsContext(),
        loaded_chat_layers_count: project.snapshot.chatOverlays?.filter((overlay) => overlay.parsedLines?.length > 0).length || 0,
        loaded_has_image: Boolean(project.snapshot.droppedImageSrc)
      });
      closePendingEditorAction();
      showProjectsDialog.value = false;
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const requestEditorAction = async (action: PendingEditorAction) => {
    if (hasUnsavedChanges.value) {
      pendingEditorAction.value = action;
      showUnsavedChangesDialog.value = true;
      return;
    }

    if (action.type === 'new-session') {
      openNewSessionDialog();
      return;
    }

    if (action.type === 'load-project' && action.projectId) {
      await loadProject(action.projectId, { bypassUnsavedCheck: true });
    }
  };

  const saveProject = async (saveOptions: SaveProjectOptions = {}) => {
    const {
      forceNewProject = false,
      autosave = false,
      refreshProjectList: shouldRefreshProjectList = true
    } = saveOptions;

    const trimmedName = autosave
      ? currentProjectName.value.trim()
      : pendingProjectName.value.trim();
    if (!trimmedName) return false;

    const now = new Date().toISOString();
    const hadExistingProject = Boolean(currentProjectId.value);
    const projectId = forceNewProject || !currentProjectId.value ? createProjectId() : currentProjectId.value;
    const existingCreatedAt = forceNewProject || !currentProjectId.value
      ? now
      : projectRecords.value.find((project) => project.id === currentProjectId.value)?.createdAt || now;

    const projectRecord: ProjectRecord = {
      id: projectId,
      name: trimmedName,
      createdAt: existingCreatedAt,
      updatedAt: now,
      snapshot: toSerializableSnapshot(createEditorSnapshot())
    };

    try {
      autosaveState.value = autosave ? 'saving' : autosaveState.value;
      await saveStoredProject(projectRecord);
      currentProjectId.value = projectRecord.id;
      currentProjectName.value = projectRecord.name;
      markCurrentStateAsSaved(projectRecord.snapshot);

      if (autosave) {
        autosaveState.value = 'saved';
      } else {
        autosaveState.value = 'idle';
        trackEvent('save_project', {
          save_mode: forceNewProject ? 'save_as_new' : hadExistingProject ? 'overwrite' : 'create',
          had_existing_project: hadExistingProject,
          ...getAnalyticsContext()
        });
        showSaveProjectDialog.value = false;
        if (shouldRefreshProjectList) {
          await refreshProjectList();
        }

        if (pendingEditorAction.value) {
          const action = pendingEditorAction.value;
          closePendingEditorAction();

          if (action.type === 'new-session') {
            resetSession();
          } else if (action.type === 'load-project' && action.projectId) {
            await loadProject(action.projectId, { bypassUnsavedCheck: true });
          }
        }
      }

      return true;
    } catch (error) {
      autosaveState.value = autosave ? 'error' : autosaveState.value;
      console.error('Error saving project:', error);
      return false;
    }
  };

  const saveAndContinuePendingAction = async () => {
    if (!pendingEditorAction.value) return;

    if (!currentProjectId.value) {
      pendingProjectName.value = currentProjectName.value || `Project ${projectRecords.value.length + 1}`;
      showUnsavedChangesDialog.value = false;
      showSaveProjectDialog.value = true;
      return;
    }

    pendingProjectName.value = currentProjectName.value;
    await saveProject();
  };

  const discardAndContinuePendingAction = async () => {
    const action = pendingEditorAction.value;
    closePendingEditorAction();
    if (!action) return;

    if (action.type === 'new-session') {
      resetSession();
      return;
    }

    if (action.type === 'load-project' && action.projectId) {
      await loadProject(action.projectId, { bypassUnsavedCheck: true });
    }
  };

  const promptSaveProject = () => {
    pendingProjectName.value = currentProjectName.value || `Project ${projectRecords.value.length + 1}`;
    showSaveProjectDialog.value = true;
  };

  const saveCurrentProject = async () => {
    if (!currentProjectId.value) {
      promptSaveProject();
      return;
    }

    pendingProjectName.value = currentProjectName.value;
    await saveProject();
  };

  const deleteProject = async (projectId: string) => {
    try {
      await deleteStoredProject(projectId);
      if (currentProjectId.value === projectId) {
        currentProjectId.value = null;
        currentProjectName.value = '';
      }
      await refreshProjectList();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const requestDeleteProject = (projectId: string, projectName: string) => {
    pendingProjectDelete.value = { id: projectId, name: projectName };
    showDeleteProjectDialog.value = true;
  };

  const closeDeleteProjectDialog = () => {
    showDeleteProjectDialog.value = false;
    pendingProjectDelete.value = null;
  };

  const confirmDeleteProject = async () => {
    const targetProject = pendingProjectDelete.value;
    if (!targetProject) return;

    await deleteProject(targetProject.id);
    closeDeleteProjectDialog();
  };

  return {
    closeDeleteProjectDialog,
    closeSaveProjectDialog,
    confirmDeleteProject,
    deleteProject,
    discardAndContinuePendingAction,
    loadProject,
    openProjectsManager,
    promptSaveProject,
    refreshProjectList,
    requestDeleteProject,
    requestEditorAction,
    saveAndContinuePendingAction,
    saveCurrentProject,
    saveProject
  };
};
