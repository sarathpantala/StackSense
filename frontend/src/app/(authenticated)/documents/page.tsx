"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Database,
  RefreshCw,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type {
  IngestResponse,
  DocumentListResponse,
  CollectionStats,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface UploadResult {
  file?: string;
  text?: string;
  status: "success" | "error";
  message: string;
  chunks?: number;
}

export default function DocumentsPage() {
  const [results, setResults] = useState<UploadResult[]>([]);
  const [textInput, setTextInput] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const queryClient = useQueryClient();

  // Fetch collection stats
  const stats = useQuery({
    queryKey: ["rag-stats"],
    queryFn: () => api.get<CollectionStats>("/rag/stats"),
  });

  // Fetch document list
  const documents = useQuery({
    queryKey: ["rag-documents"],
    queryFn: () => api.get<DocumentListResponse>("/rag/documents?limit=50"),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["rag-stats"] });
    queryClient.invalidateQueries({ queryKey: ["rag-documents"] });
  };

  // File upload mutation
  const fileUpload = useMutation({
    mutationFn: (file: File) =>
      api.uploadFile<IngestResponse>("/rag/ingest/file", file),
    onSuccess: (data, file) => {
      setResults((prev) => [
        {
          file: file.name,
          status: "success",
          message: `Ingested successfully`,
          chunks: data.chunks,
        },
        ...prev,
      ]);
      invalidateAll();
    },
    onError: (err, file) => {
      setResults((prev) => [
        {
          file: file.name,
          status: "error",
          message: err instanceof ApiError ? err.detail : "Upload failed",
        },
        ...prev,
      ]);
    },
  });

  // Text ingest mutation
  const textIngest = useMutation({
    mutationFn: (data: { text: string; source?: string; metadata?: Record<string, string> }) =>
      api.post<IngestResponse>("/rag/ingest/text", data),
    onSuccess: (data) => {
      setResults((prev) => [
        {
          text: textTitle || "Text snippet",
          status: "success",
          message: "Ingested successfully",
          chunks: data.chunks,
        },
        ...prev,
      ]);
      setTextInput("");
      setTextTitle("");
      invalidateAll();
    },
    onError: (err) => {
      setResults((prev) => [
        {
          text: textTitle || "Text snippet",
          status: "error",
          message: err instanceof ApiError ? err.detail : "Ingestion failed",
        },
        ...prev,
      ]);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (pointIds: string[]) =>
      api.post<{ deleted: number }>("/rag/documents", { point_ids: pointIds }, { method: "DELETE" }),
    onSuccess: () => invalidateAll(),
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => fileUpload.mutate(file));
    },
    [fileUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
      "text/markdown": [".md"],
      "text/csv": [".csv"],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    textIngest.mutate({
      text: textInput,
      source: textTitle || "upload",
      metadata: textTitle ? { title: textTitle } : undefined,
    });
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Upload files or paste text to build your knowledge base.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={invalidateAll}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Database className="h-5 w-5 text-zinc-400" />
            <div>
              <p className="text-2xl font-bold">
                {stats.data?.vectors_count ?? "—"}
              </p>
              <p className="text-xs text-zinc-500">Total chunks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FileText className="h-5 w-5 text-zinc-400" />
            <div>
              <p className="text-2xl font-bold">
                {stats.data?.collection ?? "—"}
              </p>
              <p className="text-xs text-zinc-500">Collection</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center gap-2">
              <Badge variant={stats.data?.status === "green" ? "success" : "secondary"}>
                {stats.data?.status ?? "unknown"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Collection status</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                isDragActive
                  ? "border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-900"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
              )}
            >
              <input {...getInputProps()} />
              <Upload
                className={cn(
                  "mb-3 h-8 w-8",
                  isDragActive ? "text-zinc-900 dark:text-white" : "text-zinc-400",
                )}
              />
              {isDragActive ? (
                <p className="text-sm font-medium">Drop files here</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Drag & drop files here</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    or click to browse — TXT, MD, CSV up to 10MB
                  </p>
                </>
              )}
            </div>
            {fileUpload.isPending && (
              <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
                <Spinner size={14} />
                Uploading...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Text Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paste Text</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="Document title"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="text">Content</Label>
                <Textarea
                  id="text"
                  placeholder="Paste your text here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={6}
                />
              </div>
              <Button
                type="submit"
                disabled={!textInput.trim() || textIngest.isPending}
                className="w-full"
              >
                {textIngest.isPending ? (
                  <Spinner size={16} />
                ) : (
                  <>
                    <FileText className="mr-1.5 h-4 w-4" />
                    Ingest Text
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Upload Results */}
      {results.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Uploads</h2>
            <Button variant="ghost" size="sm" onClick={() => setResults([])}>
              Clear all
            </Button>
          </div>
          <div className="space-y-2">
            {results.map((result, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-4 py-3",
                  result.status === "success"
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                    : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
                )}
              >
                {result.status === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{result.file || result.text}</p>
                  <p className="text-xs text-zinc-500">
                    {result.message}
                    {result.chunks != null && ` · ${result.chunks} chunks`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document List */}
      {documents.data && documents.data.documents.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">
            Stored Chunks{" "}
            <span className="text-sm font-normal text-zinc-500">
              ({documents.data.total} total)
            </span>
          </h2>
          <div className="space-y-2">
            {documents.data.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {doc.text}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {typeof doc.metadata.source === "string" && (
                      <Badge variant="secondary">{doc.metadata.source}</Badge>
                    )}
                    <span className="text-xs text-zinc-400 font-mono">{doc.id.slice(0, 8)}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-zinc-400 hover:text-red-500"
                  onClick={() => deleteMutation.mutate([doc.id])}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
