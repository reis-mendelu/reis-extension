import { X, Check, ChevronDown, Calendar, Clock } from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';
import { Button } from './ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select"
import { useState, useEffect } from 'react';
import { fetchExamData } from '../api/exams';

export interface ExamTerm {
    id: string;
    date: string;
    time: string;
    capacity?: string;
    full?: boolean;
    room?: string;
    teacher?: string;
}

export interface ExamSection {
    id: string;
    name: string;
    type: string;
    status: string;
    registeredTerm?: { date: string; time: string; room?: string; teacher?: string };
    terms: ExamTerm[];
}

export interface ExamSubject {
    id: string;
    name: string;
    code: string;
    sections: ExamSection[];
}

interface ExamDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ExamDrawer({ isOpen, onClose }: ExamDrawerProps) {
    if (!isOpen) return null;

    const [exams, setExams] = useState<ExamSubject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            fetchExamData()
                .then(data => {
                    setExams(data);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setError("Failed to load exams");
                    setIsLoading(false);
                });
        }
    }, [isOpen]);

    const [selections, setSelections] = useState<Record<string, { date: string | undefined; time: string | undefined }>>({});
    const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});

    const toggleEdit = (sectionId: string) => {
        setEditingSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    const handleDateSelect = (sectionId: string, date: string) => {
        setSelections(prev => ({
            ...prev,
            [sectionId]: { date, time: undefined } // Reset time when date changes
        }));
    };

    const handleTimeSelect = (sectionId: string, timeId: string) => {
        setSelections(prev => ({
            ...prev,
            [sectionId]: { ...prev[sectionId], time: timeId }
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end items-stretch p-4 isolate">
            {/* Layer 0: Scrim */}
            <div
                className="absolute inset-0 bg-black/15 transition-opacity"
                onClick={onClose}
            />

            {/* Layer 1: The Component - Exam Drawer */}
            <div className="relative w-[700px] bg-white shadow-2xl rounded-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden border border-gray-100 font-sans">

                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 bg-white border-b border-slate-100">
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Zkoušky</h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Scrollable List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            Načítání zkoušek...
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full text-red-500">
                            {error}
                        </div>
                    ) : (
                        <Accordion.Root type="single" collapsible className="flex flex-col">
                            {exams.map((subject) => {
                                // Determine subject status for the badge/dot
                                // If any section is registered -> Green Check
                                // If any section is open -> Orange Dot
                                const isRegistered = subject.sections.some(s => s.status === 'registered');

                                return (
                                    <Accordion.Item key={subject.id} value={subject.id} className="border-b border-slate-100 last:border-0">
                                        <Accordion.Header className="flex">
                                            <Accordion.Trigger className="flex flex-1 items-center justify-between px-6 py-4 bg-white hover:bg-slate-50 transition-all group data-[state=open]:bg-slate-50/50">
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="font-semibold text-slate-900 text-base truncate max-w-[250px]">{subject.code}</span>
                                                    <span className="text-sm text-slate-500 font-medium">{subject.name.replace(/ZS\s+\d{4}\/\d{4}\s+-\s+\w+/, '').trim() || 'Zkouška'}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {isRegistered ? (
                                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">
                                                            <Check size={12} strokeWidth={3} />
                                                            Přihlášen
                                                        </span>
                                                    ) : (
                                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                    )}
                                                    <ChevronDown className="text-slate-400 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" size={16} />
                                                </div>
                                            </Accordion.Trigger>
                                        </Accordion.Header>
                                        <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                                            <div className="px-6 py-4 bg-slate-50/50 space-y-1">
                                                {subject.sections.map((section) => {
                                                    const selection = selections[section.id] || {};
                                                    const selectedDate = selection.date;
                                                    const selectedTime = selection.time;
                                                    const isEditing = editingSections[section.id];

                                                    // Filter terms based on selected date
                                                    const availableTerms = section.terms.filter(t => t.date === selectedDate);
                                                    const uniqueDates = Array.from(new Set(section.terms.map(t => t.date)));

                                                    return (
                                                        <div key={section.id} className="group flex items-center gap-4 p-3 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-200">

                                                            {/* Column 1: Name */}
                                                            <div className="w-[180px] shrink-0">
                                                                <div className="font-medium text-slate-900 text-sm">{section.name}</div>
                                                            </div>

                                                            {section.status === 'registered' && !isEditing ? (
                                                                /* Registered State Row */
                                                                <div className="flex-1 flex items-center justify-between group/row">
                                                                    <div className="flex items-center gap-3">
                                                                        {/* Date Box */}
                                                                        <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-900 shadow-sm">
                                                                            {section.registeredTerm?.date}
                                                                        </div>

                                                                        {/* Arrow */}
                                                                        <div className="text-slate-300">
                                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                                                        </div>

                                                                        {/* Time Box */}
                                                                        <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-900 shadow-sm">
                                                                            {section.registeredTerm?.time}
                                                                        </div>

                                                                        {/* Location/Teacher Info (Optional, maybe on hover or below?) 
                                                                            User sketch doesn't explicitly show it in the row, but requested "I should definitely see...". 
                                                                            Let's put it next to it or keep it simple as per sketch.
                                                                            Sketch shows: [Date] -> [Time] [Potvrdit/Přihlášen]
                                                                            Let's add the green badge at the end.
                                                                        */}
                                                                    </div>

                                                                    <div className="flex items-center gap-3">
                                                                        {/* Room/Teacher info - subtle */}
                                                                        {(section.registeredTerm?.room || section.registeredTerm?.teacher) && (
                                                                            <div className="flex flex-col items-end mr-2 text-xs text-slate-500">
                                                                                {section.registeredTerm?.room && <span>{section.registeredTerm.room}</span>}
                                                                                {section.registeredTerm?.teacher && <span>{section.registeredTerm.teacher}</span>}
                                                                            </div>
                                                                        )}

                                                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-100 uppercase tracking-wider flex items-center gap-1.5">
                                                                            <Check size={14} strokeWidth={2.5} />
                                                                            Přihlášen
                                                                        </span>

                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-8 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 opacity-0 group-hover/row:opacity-100 transition-opacity"
                                                                            onClick={() => toggleEdit(section.id)}
                                                                        >
                                                                            Změnit
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                /* Open State Row */
                                                                <>
                                                                    {/* Column 2: Date */}
                                                                    <div className="w-[140px]">
                                                                        <Select
                                                                            value={selectedDate}
                                                                            onValueChange={(val) => handleDateSelect(section.id, val)}
                                                                        >
                                                                            <SelectTrigger className={`w-full h-9 text-sm transition-colors ${selectedDate ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-white hover:border-slate-200'}`}>
                                                                                <div className="flex items-center gap-2">
                                                                                    <Calendar size={14} className="text-slate-400" />
                                                                                    <SelectValue placeholder="Datum" />
                                                                                </div>
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {uniqueDates.map(date => (
                                                                                    <SelectItem key={date} value={date}>{date}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>

                                                                    {/* Arrow */}
                                                                    <div className={`transition-colors ${selectedDate ? 'text-slate-400' : 'text-slate-200'}`}>
                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                                                    </div>

                                                                    {/* Column 3: Time */}
                                                                    <div className="w-[120px]">
                                                                        <Select
                                                                            value={selectedTime}
                                                                            onValueChange={(val) => handleTimeSelect(section.id, val)}
                                                                            disabled={!selectedDate}
                                                                        >
                                                                            <SelectTrigger className={`w-full h-9 text-sm transition-colors ${selectedTime ? 'bg-white border-slate-200 text-slate-900' : (!selectedDate ? 'bg-slate-50 border-transparent text-slate-300 cursor-not-allowed' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-white hover:border-slate-200')}`}>
                                                                                <div className="flex items-center gap-2">
                                                                                    <Clock size={14} className={!selectedDate ? "text-slate-200" : "text-slate-400"} />
                                                                                    <SelectValue placeholder="Čas" />
                                                                                </div>
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {availableTerms.map(term => (
                                                                                    <SelectItem key={term.id} value={term.id} disabled={term.full}>
                                                                                        <span className={term.full ? 'text-red-500' : ''}>
                                                                                            {term.time} {term.capacity ? `(${term.capacity})` : ''}
                                                                                        </span>
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>

                                                                    {/* Column 4: Action */}
                                                                    <div className="flex-1 flex justify-end gap-2">
                                                                        {isEditing && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-9 text-slate-400 hover:text-slate-600"
                                                                                onClick={() => toggleEdit(section.id)}
                                                                            >
                                                                                Zrušit
                                                                            </Button>
                                                                        )}
                                                                        <Button
                                                                            size="sm"
                                                                            disabled={!selectedDate || !selectedTime}
                                                                            className={`font-medium h-9 px-4 rounded-md shadow-sm transition-all ${selectedDate && selectedTime
                                                                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                                                                                : 'bg-slate-100 text-slate-300 shadow-none cursor-not-allowed'
                                                                                }`}
                                                                        >
                                                                            Potvrdit
                                                                        </Button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Accordion.Content>
                                    </Accordion.Item>
                                );
                            })}
                        </Accordion.Root>
                    )}
                </div>
            </div>
        </div >
    );
}
