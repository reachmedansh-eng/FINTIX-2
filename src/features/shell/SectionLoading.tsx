import { Loader } from "./Loader";
import { SiteNav, type Area } from "./SiteNav";

/** What a section shows while its page is on the way: the same navigation bar, and the shared indicator below it. */
export function SectionLoading({ active }: { active: Area | null }) {
  return (
    <div className="section-loading">
      <SiteNav active={active} />
      <div>
        <Loader />
      </div>
    </div>
  );
}
