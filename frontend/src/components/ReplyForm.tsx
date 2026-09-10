import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiPost, ApiError } from '@/lib/api'
import type { Reply } from '@/components/ReplyThread'

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
    formState: { errors },
  } = useForm<ReplyFormValues>({ resolver: zodResolver(replySchema) })

  const replyMutation = useMutation({
    mutationFn: (values: ReplyFormValues) =>
      apiPost<{ reply: Reply }>(`/api/tickets/${ticketId}/replies`, values),
    onSuccess: () => {
      reset()
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
  })

  function onSubmit(values: ReplyFormValues) {
    replyMutation.mutate(values)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2" noValidate>
      <Textarea
        aria-label="Reply message"
        placeholder="Write a reply…"
        rows={4}
        aria-invalid={!!errors.body}
        {...register('body')}
      />
      {errors.body && (
        <p role="alert" className="text-sm text-destructive">
          {errors.body.message}
        </p>
      )}
      {replyMutation.isError && (
        <p className="text-sm text-destructive">
          {replyMutation.error instanceof ApiError
            ? replyMutation.error.message
            : 'Failed to send reply'}
        </p>
      )}
      <Button type="submit" disabled={replyMutation.isPending}>
        {replyMutation.isPending ? 'Sending…' : 'Send reply'}
      </Button>
    </form>
  )
}
