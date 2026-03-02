import SwiftUI

struct GeneratorView: View {
    @State var viewModel: GeneratorViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                @Bindable var vm = viewModel
                VStack(spacing: 14) {
                    StylePickerView(
                        style: $vm.parameters.style,
                        key: $vm.parameters.key
                    )

                    MoodPickerView(mood: $vm.parameters.mood)

                    TempoSliderView(tempo: $vm.parameters.tempo)

                    DurationPickerView(duration: $vm.parameters.duration)

                    // Generated description
                    if !viewModel.generatedDescription.isEmpty {
                        HStack {
                            Image(systemName: "quote.bubble")
                                .foregroundStyle(.secondary)
                            Text(viewModel.generatedDescription)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .italic()
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .transition(.opacity)
                    }

                    // Playback card (shown after successful generation)
                    if case .success = viewModel.generationState {
                        @Bindable var player = viewModel.player
                        GeneratedTrackPlayerView(
                            title: viewModel.lastGeneratedTitle,
                            player: player,
                            trackID: viewModel.lastGeneratedTrackID,
                            onToggle: { viewModel.toggleLastTrack() }
                        )
                        .transition(AnyTransition.opacity)
                    }

                    GenerateButtonView(
                        state: viewModel.generationState,
                        action: { viewModel.generate() }
                    )
                    .padding(.top, 4)
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Piano Generator")
            .navigationBarTitleDisplayMode(.large)
            .alert("Generation Failed", isPresented: failedBinding) {
                Button("OK", role: .cancel) { viewModel.resetState() }
            } message: {
                if case .failed(let msg) = viewModel.generationState {
                    Text(msg)
                }
            }
        }
    }

    private var failedBinding: Binding<Bool> {
        Binding(
            get: {
                if case .failed = viewModel.generationState { return true }
                return false
            },
            set: { if !$0 { viewModel.resetState() } }
        )
    }
}
