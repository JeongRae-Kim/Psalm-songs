
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useSongs from "../hooks/useSongs";
import useFavorites from "../hooks/useFavorites";
import useRecent from "../hooks/useRecent";
import SongCard from "../components/SongCard";
import SearchBar from "../components/SearchBar";
import FilterChips from "../components/FilterChips";
import SortDropdown from "../components/SortDropdown";

export default function HomePage() {
  const navigate = useNavigate();
  const { songs, loading, error } = useSongs();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { recent } = useRecent();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("number");

  // 검색 + 필터 + 정렬 적용
  const filteredSongs = useMemo(() => {
    let result = [...songs];

    // 필터
    if (filter === "psalm") {
      result = result.filter((s) => s.psalmNumber !== null);
    } else if (filter === "isaiah") {
      result = result.filter((s) => s.psalmNumber === null);
    } else if (filter === "favorites") {
      result = result.filter((s) => favorites.includes(s.id));
    } else if (filter === "recent") {
      result = result.filter((s) => recent.includes(s.id));
      // 최근 본 순서 유지
      result.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
      return result; // 최근 필터는 별도 정렬 스킵
    }

    // 검색
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.scripture.toLowerCase().includes(q) ||
          s.tuneName.toLowerCase().includes(q) ||
          (s.psalmNumber && String(s.psalmNumber).includes(q))
      );
    }

    // 정렬
    if (sort === "number") {
      result.sort((a, b) => (a.psalmNumber ?? 999) - (b.psalmNumber ?? 999));
    } else if (sort === "title") {
      result.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    }

    return result;
  }, [songs, search, filter, sort, favorites, recent]);

  return (
    <div className="min-h-screen bg-page">
      {/* 헤더 */}
          
      <header className="bg-header border-b border-b-light px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-t-primary">시편 찬송</h1>
          <button
            onClick={() => navigate("/settings")}
            className="text-t-hint hover:text-t-primary transition-colors"
            title="설정"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-3xl mx-auto px-4 py-4">
        {/* 로딩 */}
        {loading && (
          <p className="text-center text-t-hint py-12">불러오는 중…</p>
        )}

        {/* 에러 */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-2">데이터를 불러올 수 없습니다</p>
            <p className="text-sm text-t-hint">{error}</p>
          </div>
        )}

        {/* 검색·필터·정렬 + 곡 목록 */}
        {!loading && !error && (
          <>
            {/* 검색창 */}
            <div className="mb-3">
              <SearchBar value={search} onChange={setSearch} />
            </div>

            {/* 필터 + 곡 수 + 정렬 (한 줄) */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FilterChips active={filter} onChange={setFilter} />
                <span className="text-xs text-t-hint">{filteredSongs.length}곡</span>
              </div>
              <SortDropdown value={sort} onChange={setSort} />
            </div>

            {/* 곡 목록 */}
            {filteredSongs.length > 0 ? (
              <div className="flex flex-col gap-2">
                {filteredSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    isFavorite={isFavorite(song.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-t-hint py-12">
                검색 결과가 없습니다
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}