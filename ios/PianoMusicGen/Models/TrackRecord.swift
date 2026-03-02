import Foundation

struct TrackRecord: Identifiable, Codable {
    let id: UUID
    let fileName: String         // e.g. "piano_Happy_20251126_104447_a1b2c3d4.mid"
    let createdAt: Date
    let parameters: MusicParameters
    let fileSizeBytes: Int

    var displayTitle: String {
        "\(parameters.mood.rawValue) \(parameters.style.rawValue)"
    }

    var displaySubtitle: String {
        "\(parameters.key.rawValue) · \(parameters.tempo) BPM · \(parameters.duration.rawValue)"
    }

    var formattedDate: String {
        createdAt.formatted(date: .abbreviated, time: .shortened)
    }

    var formattedSize: String {
        let kb = Double(fileSizeBytes) / 1024.0
        return String(format: "%.1f KB", kb)
    }
}
