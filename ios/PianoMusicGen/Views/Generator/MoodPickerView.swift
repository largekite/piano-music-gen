import SwiftUI

struct MoodPickerView: View {
    @Binding var mood: Mood

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Mood", systemImage: "face.smiling")
                .font(.headline)

            HStack(spacing: 8) {
                ForEach(Mood.allCases, id: \.self) { m in
                    Button {
                        mood = m
                    } label: {
                        VStack(spacing: 4) {
                            Text(m.emoji)
                                .font(.title2)
                            Text(m.rawValue)
                                .font(.caption2)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(mood == m ? Color.accentColor.opacity(0.15) : Color(.secondarySystemBackground))
                        .foregroundStyle(mood == m ? Color.accentColor : .primary)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(mood == m ? Color.accentColor : Color.clear, lineWidth: 2)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .animation(.easeInOut(duration: 0.15), value: mood)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }
}
