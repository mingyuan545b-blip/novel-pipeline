import { useState, useEffect } from 'react';
import {
    useTestAgentConnection,
    useGetAgentModelConfig,
    useSaveAgentModelConfigFromProjects,
} from '../../hooks/queries';

export function useAgentConfigState(currentProject) {
    const [agentModelConfig, setAgentModelConfig] = useState(null);
    const [testResults, setTestResults] = useState({});
    const [showAgentConfig, setShowAgentConfig] = useState(false);

    const agentModelConfigQuery = useGetAgentModelConfig(currentProject?.id);
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (agentModelConfigQuery.data && Object.keys(agentModelConfigQuery.data).length > 0) {
            setAgentModelConfig(agentModelConfigQuery.data);
        }
    }, [agentModelConfigQuery.data]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const testConnectionMut = useTestAgentConnection();
    const saveAgentModelConfigMut = useSaveAgentModelConfigFromProjects(currentProject?.id);

    return {
        agentModelConfig, setAgentModelConfig,
        testResults, setTestResults,
        showAgentConfig, setShowAgentConfig,
        agentModelConfigQuery,
        testConnectionMut,
        saveAgentModelConfigMut,
    };
}
