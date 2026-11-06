# Library study rooms, native booking: technical brief

> **Built (2026-10-30), on branch `claude/study-rooms-rias-integration-698ae3`, not merged.**
> Code: `src/mobile/library/` (Bookings client, slots, store, `bookAndRecord`, `cancelAndRemove`),
> `src/components/mobile/screens/map/library/` (pin, tints, room list and hours),
> `src/components/mobile/sheets/Library{Book,Cancel}Sheet.tsx`, the IC split in
> `src/data/map/libraryRooms.ts`. Guard: `desktopHasNoLibraryBooking.test.ts`. The shared map
> only learned two generic things: `mapRoomTints` (colour and name a room) and the `library`
> selection kind. Live read of all six rooms' availability verified against the real service;
> create and cancel were verified by hand on 2026-10-30. **Owed:** a device run on a release
> build (the Bookings call only works through native HTTP, never in the dev webapp), then the
> store forms at release (Apple label, Play Data safety, policy gist).


Researched 2026-10-30. Not built. Decisions with Dominik are marked **decided**.

## Decided
- **Phone and iPad only** (Capacitor). No extension, no dev-webapp live booking.
- **No reIS server in the path.** The device calls Microsoft Bookings directly. No Supabase proxy, no rate-limit table, no stored hash.
- **The Seminar Room is not offered** (Dominik, 2026-10-30). That makes six bookable rooms: four in the library and the two IC rooms. The service stays in Bookings; the app just does not list it, so the 2-day lead-time rule below never applies in the UI. On the map it is an ordinary, untinted room.
- **Entry point = a small pin on the campus overview, nothing else** (Dominik, 2026-10-30). The overview is already crowded with event pins, so no label, bar or card goes over it. Reuse the pre-#275 `LibraryLayer.tsx` (git: `03f3e3d13^`): a 30 px white disc in the `reisEvents` pane, library glyph, green count badge of rooms free today, anchored at `[16.6152, 49.20996]`, shown only while no building is open, same look as `EventPin`. Tap flies to building A, floor −1, and opens the room list at about 40% of the screen. The old pin also had a hover bubble; on a phone there is no hover, so the badge carries the count. The count needs one availability call per room when the map opens, never at app start.
- **The booking lands in the reIS calendar automatically** (artifact comment, 2026-10-30): on success the app writes a `CalendarCustomEvent` (title "Studovna · …", date, start/end, room = building A) through the existing custom-event path (`customEventToLesson`, shown on both trees). Nothing to tap, no calendar permission, nothing leaves the device. No "Přidat do kalendáře" button. Because cancelling happens in the e-mail link, reIS cannot know and the block stays until the student taps "Odebrat"; say so rather than promise sync. Writing to the phone's own calendar app is not part of this. **Deleting the block today works only on the desktop tree** (`CustomEventModal` has Delete, opened from `WeeklyCalendar`). On the phone/iPad tree a custom event is shown but a tap does nothing (`useOpenLesson` returns for `isCustom`; `useOpenWeekLesson` only opens the map). So the phone needs a delete action for these blocks anyway: the "Odebrat" on the booked screen, plus a tap on the block in Den/Týden that offers "Odebrat z kalendáře".
- **IC divider** (Dominik, 2026-10-30): the mockup's cut, half and half at 90° between the two rooms, is right as drawn. Step 1 can use it.
- **Soft cap: at most 4 bookings per day per student**, counted on the device (bypassable, no server). Say so in the UI when it is reached.
- **Marker** (Dominik, 2026-10-30, revised): not needed, nice to have. Send `notes: "reIS"` on the customer (it is stored with the booking); the student has no notes field, so it is free. No further probing.
- **Cancel is done by the app** with `DELETE` on the stored `selfServiceAppointmentId` (see "Direct cancel from reIS"). No e-mail link is needed.
- Because the extension is left out, pin that decision and its reason in `src/test/guards/` (follow `desktopHasNoShowOnMap.test.ts`) when this is built.

## What was verified live on 2026-10-30
All with plain `curl` (no Origin, no cookies), which is close to what CapacitorHttp sends.

| Call | Result |
|---|---|
| `POST .../bookingBusinessesc2/RezervacestudovenMENDELU@mendelu.onmicrosoft.com/services` body `{}` | 200, 7 services |
| `POST .../GetStaffAvailability` for one room's staff GUID | 200, one block per status per day |
| `POST .../appointments` (envelope from the pre-#275 `bookings-create`) | 200, appointment created, visible in the admin calendar |
| Cancel in the Bookings admin | slot freed; availability back to one block |

A foreign web origin (example.com) cannot call it: `Failed to fetch`. So the dev webapp can't exercise the live call, and Capacitor is the only place it can run.

The services and availability endpoints need no auth. `customQuestions`, `bookingBusiness` and similar return 401.

## The ids are per room, not one shared mailbox
Each service has its own `staffMemberIds[0]`. The July allowlist in `libraryRooms.ts` (git: `03f3e3d13^`) still matches the live data for all 7 rooms. Do not assume one shared staff GUID (#150 said so; today it is per room).

## The booking form changed: two required free-text questions
Match by GUID, never by position. The order differs per service.

| Question GUID | Label |
|---|---|
| `51ae56d9-10e3-4388-8acc-590f9f2bc258` | fakulta / faculty |
| `c7fe8a04-e915-4a06-a045-36b68532ed90` | student / employee ID |

Confirmed on two rooms with opposite orders (Individual Study Room 1: faculty first; Team Study Room 1: ID first). The old code answered every question with the student ID, which would now put the ID in the faculty field. The question text is not in the `services` response, so the two GUIDs are hardcoded constants.

## Create request
Same envelope as the old edge function (`POST .../appointments`, headers `x-anchormailbox`, `x-req-source: BookingsC2`):
- `serviceId`, `staffMemberIds: [staffGuid]`, `startTime`/`endTime` as `{dateTime, timeZone: "Central Europe Standard Time"}`
- one `customers[]` entry: `name`, `emailAddress`, `answeredCustomQuestions` (id, answer, `ANSWER_INPUT_TYPE_TEXT`)
- identity comes from `getUserParams()`: `fullName`, `<username>@mendelu.cz`, `studentId`, faculty label. All local.

The response carries `appointment.id` (an EWS-style id) **and** `selfServiceAppointmentId` (the short id the booking site uses). The old code kept only the first. A future cancel via API would use the short id, but the decision is to open the email link instead.

## Rules the UI must respect
- 1-hour slots. Lead time: 1 hour (`bookingsSchedulingPolicy.minimumLeadTime`; the Seminar Room's 2 days is moot, it is not offered).
- Availability is gaps and blocks, not "free now". Say "next free hour", never "free now".
- Microsoft throttles to 4 concurrent requests per mailbox. Call availability once per room on open, not per hour tapped.
- One-time pledge ("I'll show up") the first time only.

## Privacy work that comes with it
- `bookings.cloud.microsoft` goes back into `src/test/guards/noStudentDataLeaves.test.ts` under "fetched from, carrying student data".
- `privacy/disclosures.ts` changes in the same PR (name, email, student ID, faculty go to the library's Bookings in MENDELU's own Microsoft tenant), then `npm run privacy:generate`.
- Apple privacy label, Play Data safety, the policy gist and the release PR's privacy block all change. Claude does these at release (see `/release`).
- Check whether the Firefox consent categories matter once the extension is out (they shouldn't: the extension no longer sends it).

## From the persona review (2026-10-30)
- Re-read availability when the sheet opens and again just before the create call. A librarian-blocked room must not show as free.
- A create that hangs is "unknown", not "failed": the old code noted a 2xx can arrive late. After 10 s show "Nevíme, jestli rezervace prošla"; never auto-retry; lock the button while sending so a double tap can't double-book.
- Bookings has no per-student cap that reIS knows of. A soft cap kept on the device (for example 2 active bookings, stored locally) is bypassable but needs no server. Unresolved.
- Librarians cannot tell a reIS booking from a web-form one. The `notes` field I sent in the test did not appear in the admin's details pane, so a marker is unverified. Needs a second probe or a question to the library.
- Two consecutive hours: v1 offers "Rezervovat další hodinu" after booking (a separate booking). A range picker would need two creates and partial-failure handling.

## The rooms on the map (checked against `reis-data` `map/rooms-54678.geojson`)
- The five library rooms are real polygons on building A, floor −1 (`floorId` 57574): Individuální 1 = 57621, Individuální 2 = 57625, Týmová 2 = 57627, Týmová 1 = 57632, Seminární místnost = 57631 (nickname `AS01`, 22 seats on the map).
- Both IC rooms ("Studovna IC levá" and "pravá") are **one** polygon, 57640, typed `office` with nickname `A011`, and it sits about 65 m from the other rooms. Its `type`/label in the data is wrong for tinting and needs a fix before it shows as a study room.
- **Decided (Dominik, 2026-10-30): show them as two rooms.** Physically it is one space; the librarians put a divider in it. The upper part is **Studovna IC levá**, the lower part **Studovna IC pravá**, each its own room card with its own booking.
  - The mockups cut polygon 57640 in half at 90° to its long side (ids `576401` levá, `576402` pravá). The outline is a 6.6 × 4.2 m rectangle (minimum bounding box, long side at 120° on the map), so each half is about 3.3 × 4.2 m. The cut passes through the midpoint of the long side. **That is still not a measured divider position**; check it against the library's floor plan or a photo before building.
  - Code adaptation, when built: the map data needs two polygons instead of one. Either replace feature 57640 with two features in `reis-data` `map/rooms-54678.geojson` (new ids, `type` that reads as a library room, nicknames "IC levá"/"IC pravá"), or add an app-side override next to `mergedRooms.ts` that splits it (that file already does the opposite, merging rings, so the pattern exists). The `reis-data` route keeps one source of truth and reaches the extension map too, but touches another repo and its release; the override is local to this PR.
  - Each IC room gets its own `placeId` in the room → Bookings staff mapping (the July `libraryRooms.ts` pointed both at 57640), so a tap on either polygon opens that room's card, not a chooser.
  - Anything that finds a room by id (search, "show on map", route-to-room) must still resolve 57640 if it was used before, or the id must be retired everywhere. Grep for 57640 and `A011` before changing it.
  - The extension map shows the same polygons, so it will show two IC rooms with no booking on them. Pin that in the guard together with the extension exclusion.
- Individual rooms carry `seats: 1` on the map, but the July app listed capacity 2. The Bookings services give no capacity. The mockups now show none for individual rooms; confirm with the library.
- The mockups draw these exact polygons from that file.

## The calendar block (Dominik, 2026-10-30)
Tap the block in Den or Týden → one action, "Zrušit rezervaci v knihovně". It cancels the real reservation (DELETE) and removes the block. There is deliberately no "remove from calendar only", so the calendar and the library cannot disagree. Mockup frame J. Needs a phone-tree handler for `isCustom` blocks (today `useOpenLesson` returns early) and a failed cancel is "unknown", not "cancelled".

## Reuse map: no new screens where reIS already has the mechanism (Dominik, 2026-10-30)
The mockups are inspiration. Build onto what exists:
| Mockup | Existing mechanism | What is new |
|---|---|---|
| 0 pin on overview | `EventLayer` / `SocietyPinLayer` pin pattern in the `reisEvents` pane; the old `LibraryLayer` (git `03f3e3d13^`) | one pin component and its count |
| B list, C room card, I IC rooms, G iPad | `mapSelection` + `MapPanelBody` (same slot as `EventDetailCard`, `SocietyPinCard`); phone `MapSheet`, tablet `MapRail`; the room card a tapped room already opens; `FloorStack`/`FloorSwitcher` | a `MapSelection` kind for the room list, a booking section in the room card |
| D confirm | `Sheet` primitive + `SheetHeader`, as exam `ConfirmSheet` | the booking copy |
| E booked, F/H errors | sonner toast (`toastOffset`), `logError`, the network-error mapping | none; the full "Rezervováno" screen is NOT built, a toast plus the calendar block says it |
| J block in calendar | calendar custom events (`customEventToLesson`), `Sheet` | tap handler for `isCustom` on the phone tree |
Anything in the mockups not in this table needs a reason before it becomes a new component.

## Direct cancel from reIS: it works (tested 2026-10-30)
- `DELETE .../bookingBusinessesc2/{business}/appointments/{selfServiceAppointmentId}` with the same two headers (`x-anchormailbox`, `x-req-source`), no body, no auth, returned **200**. Availability for the slot went from busy back to free, and a later `GET` of that id returned 404 "Appointment in the request not found". A test booking (Individual Study Room 1, Tue 10 Nov 2026 15:00) was created and cancelled this way; nothing remains.
- So **cancel is in the app**, not an e-mail link. `canCustomerManageTheirBooking: false` only turns off the web page's manage link; the endpoint does not check it. The earlier decision "cancel = open the e-mail link" is replaced.
- The only thing needed is the `selfServiceAppointmentId` from the create response. Keep it on the device with the booking (same place as the calendar block). It is a bearer capability: whoever holds it can cancel that booking, and it is 22 random characters, so it is not guessable. Never log it, never send it anywhere else, never put it in a URL the student shares.
- `POST .../appointments/{id}/cancel` answered 401: not a route to use.
- A cancellation e-mail does go out (Dominik, 2026-10-30), so the notice on the cancel button should say the student will get one. Not verified: that the library's admin shows the booking as cancelled rather than gone. The earlier admin-cancel left the slot free the same way.
- This route is undocumented; Microsoft could close it. Treat a failed cancel as "unknown" like a failed create: say so and point to the library.
- `sendMeetingInviteToCustomer: true`: the student also gets an Outlook meeting invite. Declining it is not known to cancel the booking.
- The customer `notes` field is stored (`"notes": "reIS"` came back in the response).

## Opening hours the app must follow
`bookingsSchedulingPolicy.bookingServiceWindows` is the source: Monday to Friday 07:00–19:00 (minutes 420–1140), Saturday and Sunday closed, 15-minute slot grid but we book whole hours. One window (2026-09-01 to 2026-09-11) overrides this, so read the windows rather than hardcoding hours or a weekend guard.

## Still open
- Faculty answer: short code ("PEF") or long name. The field is free text.
- Whether a cancellation e-mail goes to the student or the library when the app deletes a booking.
- Add `bookings.cloud.microsoft` to the iOS ATS and Android network config only if needed (HTTPS, so probably not).

## Test booking left behind
One appointment, Individual Study Room 1, Fri 6 Nov 2026 15:00, "reIS TEST - Dominik Holek": created and cancelled the same session. Nothing remains in the calendar.
