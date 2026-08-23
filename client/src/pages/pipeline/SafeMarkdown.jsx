import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeStr } from './pipelineConstants';

const SafeMarkdown = ({ children, ...props }) => {
    const text = safeStr(children);
    if (!text) return null;
    return <ReactMarkdown remarkPlugins={[remarkGfm]} {...props}>{text}</ReactMarkdown>;
};

export default SafeMarkdown;
