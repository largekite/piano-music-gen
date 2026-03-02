import SwiftUI

struct TempoSliderView: View {
    @Binding var tempo: Int

    private let range: ClosedRange<Double> = MusicParameters.tempoRange

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Tempo", systemImage: "metronome")
                    .font(.headline)
                Spacer()
                Text("\(tempo) BPM")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(Capsule())
            }

            Slider(
                value: Binding(
                    get: { Double(tempo) },
                    set: { tempo = Int($0) }
                ),
                in: range,
                step: 1
            )
            .tint(Color.accentColor)

            HStack {
                Text("Largo")
                Spacer()
                Text("Andante")
                Spacer()
                Text("Allegro")
                Spacer()
                Text("Presto")
            }
            .font(.caption2)
            .foregroundStyle(.tertiary)
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }
}
