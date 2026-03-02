import SwiftUI

struct GenerateButtonView: View {
    let state: GenerationState
    let action: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Button(action: action) {
                HStack(spacing: 10) {
                    if case .generating = state {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(0.85)
                    } else {
                        Image(systemName: buttonIcon)
                            .font(.title3)
                    }
                    Text(buttonLabel)
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(buttonColor)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(color: buttonColor.opacity(0.4), radius: 6, y: 3)
            }
            .buttonStyle(.plain)
            .disabled(isDisabled)
            .animation(.easeInOut(duration: 0.2), value: isDisabled)

            // Success indicator
            if case .success = state {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Text("Track generated! Playing now.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.3), value: "\(state)")
    }

    private var isDisabled: Bool {
        if case .generating = state { return true }
        return false
    }

    private var buttonLabel: String {
        switch state {
        case .idle:       return "Generate Music"
        case .generating: return "Generating..."
        case .success:    return "Generate Again"
        case .failed:     return "Try Again"
        }
    }

    private var buttonIcon: String {
        switch state {
        case .success: return "arrow.clockwise"
        case .failed:  return "exclamationmark.arrow.circlepath"
        default:       return "waveform.badge.plus"
        }
    }

    private var buttonColor: Color {
        switch state {
        case .success: return .green
        case .failed:  return .red
        default:       return Color.accentColor
        }
    }
}
