package tests

import (
	"strings"
	"testing"
)

// TestNIPBadgeURLGeneration tests that NIP badge URLs are correctly generated
func TestNIPBadgeURLGeneration(t *testing.T) {
	testCases := []struct {
		nipNumber int
		expected  string
	}{
		{1, "https://github.com/nostr-protocol/nips/blob/master/01.md"},
		{2, "https://github.com/nostr-protocol/nips/blob/master/02.md"},
		{5, "https://github.com/nostr-protocol/nips/blob/master/05.md"},
		{10, "https://github.com/nostr-protocol/nips/blob/master/10.md"},
		{11, "https://github.com/nostr-protocol/nips/blob/master/11.md"},
		{19, "https://github.com/nostr-protocol/nips/blob/master/19.md"},
		{44, "https://github.com/nostr-protocol/nips/blob/master/44.md"},
		{57, "https://github.com/nostr-protocol/nips/blob/master/57.md"},
		{90, "https://github.com/nostr-protocol/nips/blob/master/90.md"},
	}

	for _, tc := range testCases {
		t.Run(formatNIPNumber(tc.nipNumber), func(t *testing.T) {
			url := generateNIPSpecURL(tc.nipNumber)
			if url != tc.expected {
				t.Errorf("expected %s, got %s", tc.expected, url)
			}
		})
	}
}

// TestNIPBadgeNumberFormatting tests that NIP numbers are zero-padded correctly
func TestNIPBadgeNumberFormatting(t *testing.T) {
	testCases := []struct {
		nipNumber int
		expected  string
	}{
		{1, "01"},
		{2, "02"},
		{9, "09"},
		{10, "10"},
		{11, "11"},
		{99, "99"},
	}

	for _, tc := range testCases {
		t.Run(formatNIPNumber(tc.nipNumber), func(t *testing.T) {
			formatted := formatNIPNumber(tc.nipNumber)
			if formatted != tc.expected {
				t.Errorf("expected %s, got %s", tc.expected, formatted)
			}
		})
	}
}

// TestNIPBadgeHTMLGeneration tests that NIP badge HTML is correctly generated
func TestNIPBadgeHTMLGeneration(t *testing.T) {
	html := generateNIPBadgeHTML(1)

	// Check it's an anchor tag
	if !strings.HasPrefix(html, "<a ") {
		t.Error("expected NIP badge to be an anchor tag")
	}

	// Check href attribute
	if !strings.Contains(html, `href="https://github.com/nostr-protocol/nips/blob/master/01.md"`) {
		t.Error("expected NIP badge to have correct href")
	}

	// Check target attribute for new tab
	if !strings.Contains(html, `target="_blank"`) {
		t.Error("expected NIP badge to open in new tab")
	}

	// Check rel attribute for security
	if !strings.Contains(html, `rel="noopener noreferrer"`) {
		t.Error("expected NIP badge to have noopener noreferrer")
	}

	// Check class attribute
	if !strings.Contains(html, `class="nip-badge"`) {
		t.Error("expected NIP badge to have nip-badge class")
	}

	// Check title attribute
	if !strings.Contains(html, `title="NIP-01 - Click to view spec"`) {
		t.Error("expected NIP badge to have title with click hint")
	}

	// Check content
	if !strings.Contains(html, ">NIP-01</a>") {
		t.Error("expected NIP badge to display NIP-01")
	}
}

// TestNIPBadgeHTMLGenerationDoubleDigit tests double-digit NIP badge HTML
func TestNIPBadgeHTMLGenerationDoubleDigit(t *testing.T) {
	html := generateNIPBadgeHTML(57)

	// Check href attribute
	if !strings.Contains(html, `href="https://github.com/nostr-protocol/nips/blob/master/57.md"`) {
		t.Error("expected NIP badge to have correct href for NIP-57")
	}

	// Check title attribute
	if !strings.Contains(html, `title="NIP-57 - Click to view spec"`) {
		t.Error("expected NIP badge to have title with NIP-57")
	}

	// Check content
	if !strings.Contains(html, ">NIP-57</a>") {
		t.Error("expected NIP badge to display NIP-57")
	}
}

// Helper functions that mirror the JavaScript implementation

func formatNIPNumber(nip int) string {
	if nip < 10 {
		return "0" + string(rune('0'+nip))
	}
	return string(rune('0'+nip/10)) + string(rune('0'+nip%10))
}

func generateNIPSpecURL(nip int) string {
	return "https://github.com/nostr-protocol/nips/blob/master/" + formatNIPNumber(nip) + ".md"
}

func generateNIPBadgeHTML(nip int) string {
	nipNumber := formatNIPNumber(nip)
	specUrl := generateNIPSpecURL(nip)
	return `<a href="` + specUrl + `" target="_blank" rel="noopener noreferrer" class="nip-badge" title="NIP-` + nipNumber + ` - Click to view spec">NIP-` + nipNumber + `</a>`
}
