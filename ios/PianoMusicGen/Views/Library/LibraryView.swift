import SwiftUI

struct LibraryView: View {
    @State var viewModel: LibraryViewModel

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.tracks.isEmpty {
                    emptyState
                } else {
                    trackList
                }
            }
            .navigationTitle("Library")
            .navigationBarTitleDisplayMode(.large)
            .onAppear { viewModel.loadTracks() }
            .alert("Delete Failed", isPresented: .init(
                get: { viewModel.deletionError != nil },
                set: { if !$0 { viewModel.deletionError = nil } }
            )) {
                Button("OK", role: .cancel) { viewModel.deletionError = nil }
            } message: {
                Text(viewModel.deletionError ?? "")
            }
        }
    }

    // MARK: - Track List

    private var trackList: some View {
        List {
            ForEach(viewModel.tracks) { record in
                TrackRowView(
                    record: record,
                    isPlaying: viewModel.isPlaying(record),
                    progress: viewModel.player.currentTrackID == record.id
                        ? viewModel.player.playbackProgress : 0,
                    onTap: { viewModel.togglePlayback(for: record) },
                    onShare: { share(record: record) }
                )
            }
            .onDelete { viewModel.delete(at: $0) }
        }
        .listStyle(.insetGrouped)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "music.note.list")
                .font(.system(size: 60))
                .foregroundStyle(.quaternary)
            Text("No tracks yet")
                .font(.title2.bold())
            Text("Generate your first piano piece\non the Generate tab.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Share

    private func share(record: TrackRecord) {
        let storage = TrackStorageService()
        let fileURL = storage.fileURL(for: record)
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }

        let av = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let root = scene.windows.first?.rootViewController {
            av.popoverPresentationController?.sourceView = root.view
            root.present(av, animated: true)
        }
    }
}
