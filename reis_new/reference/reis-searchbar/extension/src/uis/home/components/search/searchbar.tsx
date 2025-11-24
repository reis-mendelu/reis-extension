import { useState, useRef, useEffect } from 'react';
import { searchGeneral } from '../general_search';
import { parseSearchResults, type GeneralSearchResults } from '../search_parser';

export interface SearchProps{

}

export function SearchBar(_:SearchProps){
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeneralSearchResults>({ people: [], subjects: [], documents: [] });
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceTimer = useRef<number | undefined>(undefined);

    // Flatten all results into a single array for keyboard navigation
    const allResults = [
        ...results.people.map(p => ({ type: 'person' as const, data: p })),
        ...results.subjects.map(s => ({ type: 'subject' as const, data: s })),
        ...results.documents.map(d => ({ type: 'document' as const, data: d })),
    ];

    const fetchResults = async (searchTerm: string) => {
        if (searchTerm.length < 3) {
            setResults({ people: [], subjects: [], documents: [] });
            setIsOpen(false);
            return;
        }

        const html = await searchGeneral(searchTerm);
        if (html) {
            const parsed = parseSearchResults(html);
            setResults(parsed);
            setIsOpen(parsed.people.length > 0 || parsed.subjects.length > 0 || parsed.documents.length > 0);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        setSelectedIndex(-1);

        // Debounce the search
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = window.setTimeout(() => {
            fetchResults(value);
        }, 150);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || allResults.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => 
                    prev < allResults.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0) {
                    handleSelectItem(allResults[selectedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setSelectedIndex(-1);
                break;
        }
    };

    const handleSelectItem = (item: typeof allResults[0]) => {
        const link = item.type === 'person' 
            ? item.data.link 
            : item.type === 'subject'
            ? item.data.link
            : item.data.link;
        
        window.open(link, '_blank');
        setIsOpen(false);
        setQuery('');
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="w-full max-w-[250px] min-w-[200px]">
            <div className="relative">
                <input
                    ref={inputRef}
                    className={"w-full bg-transparent placeholder:text-slate-400 text-slate-700 text-sm border-[1.5px] border-lime-600 rounded-md pl-3 pr-28 py-2 transition-all duration-300 ease focus:outline-none focus:border-lime-700 hover:border-lime-700 focus:scale-101 hover:scale-101 shadow-sm focus:shadow"}
                    placeholder={"Vyhledej v ISu..."}
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                />
                
                {/* Dropdown */}
                {isOpen && allResults.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute top-full left-0 right-0 mt-1 bg-white border border-lime-600 rounded-md shadow-lg max-h-64 overflow-y-auto z-50"
                        onMouseLeave={() => setSelectedIndex(-1)}
                    >
                        {/* People Section */}
                        {results.people.length > 0 && (
                            <>
                                <div className="px-3 py-2 text-base font-semibold text-slate-800 font-dm">
                                    Lidé
                                </div>
                                {results.people.map((person, idx) => {
                                    const flatIndex = idx;
                                    return (
                                        <div
                                            key={person.id || idx}
                                            className={`px-3 py-2 cursor-pointer transition-colors ${
                                                flatIndex === selectedIndex
                                                    ? 'bg-lime-100'
                                                    : 'hover:bg-lime-50'
                                            }`}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleSelectItem({ type: 'person', data: person });
                                            }}
                                            onMouseEnter={() => setSelectedIndex(flatIndex)}
                                        >
                                            <div className="text-sm font-medium text-slate-700 font-dm">
                                                {person.name}
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}

                        {/* Subjects Section */}
                        {results.subjects.length > 0 && (
                            <>
                                <div className="px-3 py-2 text-base font-semibold text-slate-800 font-dm">
                                    Předměty
                                </div>
                                {results.subjects.map((subject, idx) => {
                                    const flatIndex = results.people.length + idx;
                                    return (
                                        <div
                                            key={subject.code || idx}
                                            className={`px-3 py-2 cursor-pointer transition-colors ${
                                                flatIndex === selectedIndex
                                                    ? 'bg-lime-100'
                                                    : 'hover:bg-lime-50'
                                            }`}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleSelectItem({ type: 'subject', data: subject });
                                            }}
                                            onMouseEnter={() => setSelectedIndex(flatIndex)}
                                        >
                                            <div className="text-sm font-medium text-slate-700 font-dm">
                                                {subject.code && <span className="font-semibold">{subject.code}</span>} {subject.name}
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}

                        {/* Documents Section */}
                        {results.documents.filter(doc => doc.title !== 'Untitled').length > 0 && (
                            <>
                                <div className="px-3 py-2 text-base font-semibold text-slate-800 font-dm">
                                    Dokumenty
                                </div>
                                {results.documents
                                    .filter(doc => doc.title !== 'Untitled')
                                    .map((document, idx) => {
                                        const flatIndex = results.people.length + results.subjects.length + idx;
                                        return (
                                            <div
                                                key={idx}
                                                className={`px-3 py-2 cursor-pointer transition-colors ${
                                                    flatIndex === selectedIndex
                                                        ? 'bg-lime-100'
                                                        : 'hover:bg-lime-50'
                                                }`}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    handleSelectItem({ type: 'document', data: document });
                                                }}
                                                onMouseEnter={() => setSelectedIndex(flatIndex)}
                                            >
                                                <div className="text-sm font-medium text-slate-700 font-dm">
                                                    {document.title}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}