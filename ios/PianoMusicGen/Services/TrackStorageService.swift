import Foundation

/// Manages saving, loading, and deleting generated MIDI tracks.
/// - MIDI files: stored in Documents/GeneratedMIDI/
/// - Track metadata: stored as JSON array in UserDefaults
final class TrackStorageService {

    // MARK: - Paths

    private let documentsURL: URL = {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }()

    private var midiDirectoryURL: URL {
        documentsURL.appendingPathComponent("GeneratedMIDI", isDirectory: true)
    }

    init() {
        // Create MIDI output directory on first launch
        try? FileManager.default.createDirectory(
            at: midiDirectoryURL,
            withIntermediateDirectories: true
        )
    }

    // MARK: - Save

    /// Save generated MIDI data to disk and record its metadata.
    /// - Returns: The new TrackRecord and the file URL where it was saved
    func save(data: Data, parameters: MusicParameters) throws -> (record: TrackRecord, url: URL) {
        let id = UUID()
        let timestamp = DateFormatter.filenameSafe.string(from: Date())
        // Append UUID prefix to prevent collisions (Python used timestamp only)
        let shortID = id.uuidString.prefix(8)
        let fileName = "piano_\(parameters.mood.rawValue)_\(timestamp)_\(shortID).mid"
        let fileURL = midiDirectoryURL.appendingPathComponent(fileName)

        try data.write(to: fileURL, options: .atomic)

        let record = TrackRecord(
            id: id,
            fileName: fileName,
            createdAt: Date(),
            parameters: parameters,
            fileSizeBytes: data.count
        )
        appendRecord(record)
        return (record, fileURL)
    }

    // MARK: - Load

    /// Load all saved track records, newest first.
    func loadAll() -> [TrackRecord] {
        guard let data = UserDefaults.standard.data(forKey: recordsKey),
              let records = try? JSONDecoder().decode([TrackRecord].self, from: data)
        else { return [] }
        return records.sorted { $0.createdAt > $1.createdAt }
    }

    /// Resolve the file URL for a saved track.
    func fileURL(for record: TrackRecord) -> URL {
        midiDirectoryURL.appendingPathComponent(record.fileName)
    }

    // MARK: - Delete

    /// Delete a track's MIDI file and remove its metadata record.
    func delete(record: TrackRecord) throws {
        let url = fileURL(for: record)
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
        removeRecord(id: record.id)
    }

    // MARK: - Private

    private let recordsKey = "trackRecords"

    private func appendRecord(_ record: TrackRecord) {
        var existing = loadAll()
        existing.insert(record, at: 0)
        if let data = try? JSONEncoder().encode(existing) {
            UserDefaults.standard.set(data, forKey: recordsKey)
        }
    }

    private func removeRecord(id: UUID) {
        var existing = loadAll()
        existing.removeAll { $0.id == id }
        if let data = try? JSONEncoder().encode(existing) {
            UserDefaults.standard.set(data, forKey: recordsKey)
        }
    }
}

// MARK: - DateFormatter Helper

private extension DateFormatter {
    static let filenameSafe: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyyMMdd_HHmmss"
        return f
    }()
}
