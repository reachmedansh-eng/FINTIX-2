import "./loader.css";

/**
 * The one loading indicator in FINTIX: three pixel blocks stepping in turn.
 * Every screen that waits for something shows this, at this size, in the
 * middle of the space the finished content will take.
 */
export function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <p className="loader" role="status">
      <span aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <b>{label}</b>
    </p>
  );
}
