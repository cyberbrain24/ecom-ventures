package blog

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/pkg/response"
)

// Handler exposes HTTP controllers for Blog and 100% SEO Editorial Management.
type Handler struct {
	service *Service
}

// NewHandler instantiates the Blog Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ======================== STORE ADMIN CRM CONTROLLERS ========================

// ListPosts handles GET /api/v1/store/{store_slug}/blog/posts
func (h *Handler) ListPosts(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	filter := PostFilter{
		CategoryID: r.URL.Query().Get("category_id"),
		Tag:        r.URL.Query().Get("tag"),
		Search:     r.URL.Query().Get("search"),
		Page:       page,
		Limit:      limit,
	}

	if st := r.URL.Query().Get("status"); st != "" {
		pStatus := PostStatus(st)
		filter.Status = &pStatus
	}

	posts, total, err := h.service.ListPosts(r.Context(), sc.TenantDB, filter)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"posts": posts,
		"meta": map[string]interface{}{
			"page":        page,
			"limit":       limit,
			"total_count": total,
			"total_pages": (total + limit - 1) / limit,
		},
	})
}

// GetPost handles GET /api/v1/store/{store_slug}/blog/posts/{id}
func (h *Handler) GetPost(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())
	postID := chi.URLParam(r, "id")

	post, err := h.service.GetPost(r.Context(), sc.TenantDB, postID)
	if err != nil {
		response.NotFound(w, r, "Blog post not found.")
		return
	}

	response.JSON(w, http.StatusOK, post)
}

// CreatePost handles POST /api/v1/store/{store_slug}/blog/posts
func (h *Handler) CreatePost(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())

	var req CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request body: "+err.Error())
		return
	}

	post, err := h.service.CreatePost(r.Context(), sc.TenantDB, &req)
	if err != nil {
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, post)
}

// UpdatePost handles PUT /api/v1/store/{store_slug}/blog/posts/{id}
func (h *Handler) UpdatePost(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())
	postID := chi.URLParam(r, "id")

	var req UpdatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request body: "+err.Error())
		return
	}

	post, err := h.service.UpdatePost(r.Context(), sc.TenantDB, postID, &req)
	if err != nil {
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, post)
}

// QuickUpdateStatus handles PATCH /api/v1/store/{store_slug}/blog/posts/{id}/status
func (h *Handler) QuickUpdateStatus(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())
	postID := chi.URLParam(r, "id")

	var req struct {
		Status PostStatus `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid payload")
		return
	}

	if err := h.service.UpdatePostStatus(r.Context(), sc.TenantDB, postID, req.Status); err != nil {
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"status": req.Status,
		"msg":    "Post status updated successfully",
	})
}

// DeletePost handles DELETE /api/v1/store/{store_slug}/blog/posts/{id}
func (h *Handler) DeletePost(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())
	postID := chi.URLParam(r, "id")

	if err := h.service.DeletePost(r.Context(), sc.TenantDB, postID); err != nil {
		response.NotFound(w, r, "Blog post not found or already removed")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Blog post successfully deleted."})
}

// AnalyzeSEO handles POST /api/v1/store/{store_slug}/blog/analyze-seo
func (h *Handler) AnalyzeSEO(w http.ResponseWriter, r *http.Request) {
	var req CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request body")
		return
	}

	analysis := h.service.LiveAnalyzeSEO(&req)
	response.JSON(w, http.StatusOK, analysis)
}

// ======================== CATEGORY CONTROLLERS ========================

// ListCategories handles GET /api/v1/store/{store_slug}/blog/categories
func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())
	activeOnly := r.URL.Query().Get("active_only") == "true"

	cats, err := h.service.ListCategories(r.Context(), sc.TenantDB, activeOnly)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, cats)
}

// GetCategory handles GET /api/v1/store/{store_slug}/blog/categories/{id}
func (h *Handler) GetCategory(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())
	catID := chi.URLParam(r, "id")

	cat, err := h.service.GetCategory(r.Context(), sc.TenantDB, catID)
	if err != nil {
		response.NotFound(w, r, "Category not found")
		return
	}

	response.JSON(w, http.StatusOK, cat)
}

// CreateCategory handles POST /api/v1/store/{store_slug}/blog/categories
func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())

	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid payload")
		return
	}

	cat, err := h.service.CreateCategory(r.Context(), sc.TenantDB, &req)
	if err != nil {
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, cat)
}

// UpdateCategory handles PUT /api/v1/store/{store_slug}/blog/categories/{id}
func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())
	catID := chi.URLParam(r, "id")

	var req UpdateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid payload")
		return
	}

	cat, err := h.service.UpdateCategory(r.Context(), sc.TenantDB, catID, &req)
	if err != nil {
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, cat)
}

// DeleteCategory handles DELETE /api/v1/store/{store_slug}/blog/categories/{id}
func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())
	catID := chi.URLParam(r, "id")

	if err := h.service.DeleteCategory(r.Context(), sc.TenantDB, catID); err != nil {
		response.NotFound(w, r, "Category not found or already deleted")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Category successfully deleted."})
}

// ======================== PUBLIC STOREFRONT CONTROLLERS ========================

// StorefrontListPosts handles GET /api/v1/storefront/blog/posts
func (h *Handler) StorefrontListPosts(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 50 {
		limit = 9
	}

	categorySlug := r.URL.Query().Get("category")
	tag := r.URL.Query().Get("tag")
	search := r.URL.Query().Get("search")

	posts, total, err := h.service.StorefrontListPosts(r.Context(), sc.TenantDB, categorySlug, tag, search, page, limit)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"posts": posts,
		"meta": map[string]interface{}{
			"page":        page,
			"limit":       limit,
			"total_count": total,
			"total_pages": (total + limit - 1) / limit,
		},
	})
}

// StorefrontGetPostBySlug handles GET /api/v1/storefront/blog/posts/{slug}
func (h *Handler) StorefrontGetPostBySlug(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())
	slug := chi.URLParam(r, "slug")

	siteURL := fmt.Sprintf("https://%s", sc.Domain)
	if r.TLS == nil && !r.URL.IsAbs() {
		siteURL = fmt.Sprintf("http://%s", sc.Domain)
	}

	post, err := h.service.StorefrontGetPostBySlug(r.Context(), sc.TenantDB, slug, sc.Store.Name, siteURL)
	if err != nil {
		response.NotFound(w, r, "Article not found or not published.")
		return
	}

	response.JSON(w, http.StatusOK, post)
}

// StorefrontListCategories handles GET /api/v1/storefront/blog/categories
func (h *Handler) StorefrontListCategories(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())

	cats, err := h.service.ListCategories(r.Context(), sc.TenantDB, true)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, cats)
}

// StorefrontSitemapFeed handles GET /api/v1/storefront/blog/sitemap
func (h *Handler) StorefrontSitemapFeed(w http.ResponseWriter, r *http.Request) {
	sc := storeCtx.MustGetStoreContext(r.Context())

	items, err := h.service.StorefrontSitemap(r.Context(), sc.TenantDB)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"sitemap": items,
	})
}
