import SwiftUI

struct DurationPickerView: View {
    @Binding var duration: Duration

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Duration", systemImage: "clock")
                .font(.headline)

            HStack(spacing: 8) {
                ForEach(Duration.allCases, id: \.self) { d in
                    Button {
                        duration = d
                    } label: {
                        Text(d.rawValue)
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(duration == d ? Color.accentColor : Color(.secondarySystemBackground))
                            .foregroundStyle(duration == d ? .white : .primary)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .animation(.easeInOut(duration: 0.15), value: duration)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }
}
