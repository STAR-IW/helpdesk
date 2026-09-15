import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiPost, ApiError } from '@/lib/api'
import type { Reply } from '@/constants/reply'

const replySchema = z.object({
  body: z.string().trim().min(1, 'Reply cannot be empty'),
})

type ReplyFormValues = z.infer<typeof replySchema>

type ReplyFormProps = {
  ticketId: string
}

export function ReplyForm({ ticketId }: ReplyFormProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
  } = useForm<ReplyFormValues>({ resolver: zodResolver(replySchema) })

  const isBodyEmpty = !watch('body')?.trim()

  const replyMutation = useMutation({
    mutationFn: (values: ReplyFormValues) =>
      apiPost<{ reply: Reply }>(`/api/tickets/${ticketId}/replies`, values),
    onSuccess: () => {
      reset()
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
  })

  const polishMutation = useMutation({
    mutationFn: (body: string) =>
      apiPost<{ text: string }>(`/api/tickets/${ticketId}/replies/polish`, { body }),
    onSuccess: ({ text }) => {
      setValue('body', text, { shouldValidate: true })
    },
  })

  function onSubmit(values: ReplyFormValues) {
    replyMutation.mutate(values)
  }

  function onPolish() {
    const body = getValues('body')?.trim()
    if (!body) return
    polishMutation.mutate(body)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2" noValidate>
      <Textarea
        aria-label="Reply message"
        placeholder="Write a reply…"
        rows={4}
        {...register('body')}
      />
      {polishMutation.isError && (
        <p className="text-sm text-destructive">
          {polishMutation.error instanceof ApiError
            ? polishMutation.error.message
            : 'Failed to polish reply'}
        </p>
      )}
      {replyMutation.isError && (
        <p className="text-sm text-destructive">
          {replyMutation.error instanceof ApiError
            ? replyMutation.error.message
            : 'Failed to send reply'}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onPolish}
          disabled={isBodyEmpty || polishMutation.isPending || replyMutation.isPending}
        >
          {polishMutation.isPending ? 'Polishing…' : 'Polish'}
        </Button>
        <Button type="submit" disabled={isBodyEmpty || replyMutation.isPending}>
          {replyMutation.isPending ? 'Sending…' : 'Send reply'}
        </Button>
      </div>
    </form>
  )
}
