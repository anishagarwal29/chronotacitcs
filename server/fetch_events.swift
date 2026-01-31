import Foundation
import EventKit

let store = EKEventStore()

// Request access to events
// Note: In a real CLI app, this might just check status. 
// Terminal might prompt user for permission on first run.
let status = EKEventStore.authorizationStatus(for: .event)

func fetchEvents() {
    let calendars = store.calendars(for: .event)
    
    // Get events for next 7 days
    let startDate = Date()
    let endDate = Calendar.current.date(byAdding: .day, value: 7, to: startDate)!
    
    let predicate = store.predicateForEvents(withStart: startDate, end: endDate, calendars: calendars)
    let events = store.events(matching: predicate)
    
    let dateFormatter = ISO8601DateFormatter()
    
    let jsonEvents = events.map { event -> [String: Any] in
        return [
            "uid": event.eventIdentifier ?? UUID().uuidString,
            "summary": event.title ?? "No Title",
            "start": dateFormatter.string(from: event.startDate),
            "end": dateFormatter.string(from: event.endDate),
            "description": event.notes ?? "",
            "isRecurring": event.hasRecurrenceRules
        ]
    }
    
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: jsonEvents, options: .prettyPrinted)
        if let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
    } catch {
        print("[]")
    }
}

if status == .authorized {
    fetchEvents()
} else {
    // Attempt request (this is async, might be tricky in cli, but for simple script we hope for the best or existing permissions)
    let semaphore = DispatchSemaphore(value: 0)
    store.requestAccess(to: .event) { (granted, error) in
        if granted {
            fetchEvents()
        } else {
            print("[]")
            fputs("Access denied\n", stderr)
        }
        semaphore.signal()
    }
    semaphore.wait()
}
