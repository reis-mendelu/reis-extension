import { Nav } from "./components/nav/nav";
import { Spacemaker } from "./components/spacemaker/spacemaker";
import { useEffect, useState } from "react";
import { checkStoredSubjects, fetchSubjectsFromServer, storeFetchedSubjects } from "./components/helper_ignore";
import { Divider } from "./components/devider/devider";
import { SchedueleScreenComponent } from "./components/screens/screens";
import SchoolCalendar, { type BlockLesson } from "./components/scheduele/scheduele";
import { fetchDayScheduele } from "./components/subject_fetcher";
import { GenericFooter } from "./components/footer/footer";
import { Sidebar } from "./components/sidebar/Sidebar";

export function HomePage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [scheduele, setScheduele] = useState<BlockLesson[] | null>(null);
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Check URL to determine which screen to show
  const isScheduleScreen = currentRoute.includes('/osobni_rozvrh');

  // Function to navigate to schedule by changing URL
  const navigateToSchedule = () => {
    window.history.pushState({}, '', '/auth/osobni_rozvrh');
    setCurrentRoute('/auth/osobni_rozvrh');
  };

  // Function to navigate home
  const navigateToHome = () => {
    window.history.pushState({}, '', '/auth/');
    setCurrentRoute('/auth/');
  };

  // Listen for URL changes (back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keyboard support - ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  //
  useEffect(() => {
    (async () => {
      // Check if cached user_id matches current logged-in user
      const cachedUserId = localStorage.getItem("user_id");
      if (cachedUserId) {
        // Fetch current user's actual ID
        const currentUserId = await (async () => {
          try {
            const response = await fetch("https://is.mendelu.cz/auth/student/studium.pl");
            const html = await response.text();
            const parser = new DOMParser().parseFromString(html, "text/html");
            const tds = parser.getElementsByTagName("td");
            for (let i = 0; i < tds.length; i++) {
              if (tds[i].innerText?.toLowerCase().includes("identif")) {
                return tds[i + 1]?.innerText.replace(" ", "") || null;
              }
            }
            return null;
          } catch {
            return null;
          }
        })();

        // If IDs don't match, clear all cached data
        if (currentUserId && currentUserId !== cachedUserId) {
          console.log(`[STORAGE] User changed from ${cachedUserId} to ${currentUserId}, clearing cache`);
          localStorage.clear(); // Clear everything
        }
      }

      const stored_subjects = await checkStoredSubjects();
      if (stored_subjects == false) {
        try {
          const fetched_subjects = await fetchSubjectsFromServer();
          if (Object.keys(fetched_subjects.data).length == 0) {
            setError("Nezdařilio se načíst informace ze systému. Zkuste znovu načíst aktuální záložku.")
          } else {
            await storeFetchedSubjects(fetched_subjects);
          }
        } catch (error) {
          console.error(error);
          setError("Při načítání došlo ke kritické chybě. :(");
          return;
        }
      }
      //SCHEDUELE FETCHING
      try {
        const scheduele = await fetchDayScheduele();
        setScheduele(scheduele ?? []);
      } catch (e) {
        console.error("Critical error fetching schedule:", e);
        setScheduele([]);
      }
      //
      setLoading(false);
    })();
  }, []);
  //
  if (error != "") {
    return (
      <div className="w-screen h-screen flex flex-col items-center bg-gray-50 select-none justify-center items-center">
        <span className="font-dm text-base xl:text-xl text-gray-700 font-semibold">{error}</span>
      </div>
    )
  }
  //
  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center bg-gray-50 select-none justify-center items-center">
        <span className="font-dm text-base xl:text-xl mb-4 text-gray-700 font-semibold">Načítání informací ze systému</span>
        <>
          <style>
            {`@keyframes rotation {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
              }`}
          </style>
          <span className='w-16 h-16'
            style={{
              border: "5px solid #8DC843",
              borderBottomColor: "transparent",
              borderRadius: "50%",
              display: "inline-block",
              boxSizing: "border-box",
              animation: "rotation 1s linear infinite",
            }}
          ></span>
        </>
      </div>
    )
  }
  //
  // Render schedule screen or home screen based on URL
  if (isScheduleScreen) {
    return (
      <div className="relative h-screen overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={handleSidebarClose}
          onMouseLeave={() => { }}

          onNavigateSchedule={navigateToSchedule}
        />
        <div className="w-full h-full overflow-auto">
          <SchedueleScreenComponent type="SCHEDUELE" setter={() => navigateToHome()} onToggleSidebar={() => setSidebarOpen(true)} />
        </div>
      </div>
    );
  }
  //
  return (
    <div className="relative h-screen overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
        onMouseLeave={() => { }}

        onNavigateSchedule={navigateToSchedule}
      />
      <div className="w-full h-full overflow-auto">
        <div className="w-full h-full flex flex-col items-center bg-gray-50 select-none">
          <Nav setScreen={() => navigateToSchedule()} onToggleSidebar={() => setSidebarOpen(true)} />
          <Spacemaker space="mt-8" />
          <span className="font-dm text-lg font-semibold text-gray-800 text-xl">{"Dnešní rozvrh"}</span>
          <Spacemaker space="mb-1" />
          {/*Scheduele*/}
          <SchoolCalendar data={scheduele ?? []} />
          {/*Scheduele*/}
          <Divider customStyle="mt-8" />
          {/*Space filler*/}
          <div className="flex flex-1 w-full"></div>
          {/**/}
          <GenericFooter />
        </div>
      </div>
    </div>
  )
}