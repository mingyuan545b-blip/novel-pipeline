import { usePublishState } from './usePublishState';
import { usePublishActions } from './usePublishActions';

export { MULTI_PLATFORMS, defaultConfig, TABS, DEFAULT_ACCOUNT, DEFAULT_INTERACTION } from './publishConstants';

export function usePublish() {
    const state = usePublishState();
    const actions = usePublishActions(state);

    return {
        ...state,
        ...actions
    };
}
