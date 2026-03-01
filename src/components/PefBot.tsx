import { useState, useEffect, useRef } from 'react';

const PEFBOT_URL = 'https://reis-mendelu.github.io/reis-data/pefbot.html';

interface PefBotProps {
    visible: boolean;
}

export function PefBot({ visible }: PefBotProps) {
    const [chatOpen, setChatOpen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const handle = (e: MessageEvent) => {
            if (e.data?.type === 'PEFBOT_STATE') {
                setChatOpen(e.data.state === 'open');
            }
        };
        window.addEventListener('message', handle);
        return () => window.removeEventListener('message', handle);
    }, []);

    const size = chatOpen
        ? { width: '420px', height: '600px' }
        : { width: '280px', height: '55px' };

    return (
        <iframe
            ref={iframeRef}
            src={PEFBOT_URL}
            title="PEFbot"
            className="fixed bottom-4 right-4 z-50 border-none"
            style={{
                display: visible ? 'block' : 'none',
                width: size.width,
                height: size.height,
                background: 'transparent',
                colorScheme: 'normal',
                overflow: 'hidden',
            }}
            allow="microphone"
            allowTransparency
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
    );
}
