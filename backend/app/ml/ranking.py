import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

class RankingEngine:
    """
    Ranks person candidates based on multimodal appearance matching signals.
    Combines Image-to-Image similarity, Text-to-Image similarity, and attribute alignment.
    
    CRITICAL COMPLIANCE NOTICE:
    Scores represent relative mathematical similarity metrics, NOT probabilities or biometric identification.
    Results are potential visual matches intended strictly for human verification.
    """
    def __init__(self, default_image_weight: float = 0.50, default_text_weight: float = 0.50):
        self.default_image_weight = default_image_weight
        self.default_text_weight = default_text_weight

    def calculate_score(
        self,
        image_similarity: Optional[float] = None,
        text_similarity: Optional[float] = None,
        image_weight: Optional[float] = None,
        text_weight: Optional[float] = None,
        attribute_match: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Computes composite ranking score and generates human-readable evidence explanation.
        """
        w_img = image_weight if image_weight is not None else self.default_image_weight
        w_txt = text_weight if text_weight is not None else self.default_text_weight

        # Normalize weights if both provided
        if image_similarity is not None and text_similarity is not None:
            total_w = w_img + w_txt
            if total_w > 0:
                w_img = w_img / total_w
                w_txt = w_txt / total_w
            else:
                w_img, w_txt = 0.5, 0.5
            combined = (w_img * image_similarity) + (w_txt * text_similarity)
            mode_used = "multimodal_image_and_text"
        elif image_similarity is not None:
            combined = image_similarity
            mode_used = "image_only"
            w_img = 1.0
            w_txt = 0.0
        elif text_similarity is not None:
            combined = text_similarity
            mode_used = "text_only"
            w_img = 0.0
            w_txt = 1.0
        else:
            combined = 0.0
            mode_used = "none"

        combined = round(float(combined), 4)

        # Categorize similarity tier for filtering
        if combined >= 0.70:
            ranking_tier = "High Similarity Match"
        elif combined >= 0.50:
            ranking_tier = "Moderate Similarity Match"
        else:
            ranking_tier = "Low Visual Alignment"

        evidence = {
            "mode": mode_used,
            "weights": {"image_weight": round(w_img, 2), "text_weight": round(w_txt, 2)},
            "component_scores": {
                "image_similarity": round(image_similarity, 4) if image_similarity is not None else None,
                "text_similarity": round(text_similarity, 4) if text_similarity is not None else None
            },
            "ranking_tier": ranking_tier,
            "disclaimer": "Potential visual appearance match requiring human review. Not biometric or criminal identification."
        }

        if attribute_match:
            evidence["detected_attributes"] = attribute_match.get("summary", "N/A")

        return {
            "combined_score": combined,
            "evidence": evidence
        }

    def rank_candidates(
        self,
        candidates: List[Dict[str, Any]],
        image_weight: Optional[float] = None,
        text_weight: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Ranks a list of candidate tracks descending by combined similarity score."""
        ranked = []
        for cand in candidates:
            score_data = self.calculate_score(
                image_similarity=cand.get("image_similarity"),
                text_similarity=cand.get("text_similarity"),
                image_weight=image_weight,
                text_weight=text_weight,
                attribute_match=cand.get("attributes")
            )
            cand_copy = dict(cand)
            cand_copy["combined_score"] = score_data["combined_score"]
            cand_copy["match_evidence"] = score_data["evidence"]
            ranked.append(cand_copy)

        ranked.sort(key=lambda x: x["combined_score"], reverse=True)
        return ranked

