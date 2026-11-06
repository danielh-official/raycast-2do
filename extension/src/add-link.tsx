import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { fetchPage } from "./link";
import { TaskForm } from "./task-form";

// Step one takes a URL; step two is the task form, prefilled from the page.
export default function Command() {
  const { push } = useNavigation();
  const { handleSubmit, itemProps } = useForm<{ url: string }>({
    validation: {
      url: (v) => {
        if (!v) return "Required";
        if (!/^https?:\/\//i.test(v) || !URL.canParse(v)) return "Enter a web address, like https://example.com";
      },
    },
    async onSubmit({ url }) {
      const toast = await showToast({ style: Toast.Style.Animated, title: "Reading page" });
      try {
        const page = await fetchPage(url);
        await toast.hide();
        push(<TaskForm link={{ url, ...page, title: page.title || url }} />);
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = "Could not read page";
        toast.message = error instanceof Error ? error.message : String(error);
        push(<TaskForm link={{ url, title: url, description: "" }} />);
      }
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Continue" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Link" placeholder="https://" {...itemProps.url} />
    </Form>
  );
}
