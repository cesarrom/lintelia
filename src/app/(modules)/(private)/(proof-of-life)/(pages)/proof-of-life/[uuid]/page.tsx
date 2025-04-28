'use client'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDebounce } from 'use-debounce';
import { useParams } from 'next/navigation'

const instructions = [
  { text: "Look straight at the camera", action: "neutral" },
  { text: "Smile", action: "smile" }
]

export default function ProofOfLifePage() {
  const { uuid: resumeId } = useParams<{ uuid: string }>();
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isDetecting, setIsDetecting] = useState(false)
  const [message, setMessage] = useState("Press Start to begin liveness detection")
  const [isDetectingDebounced] = useDebounce(isDetecting, 1000);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) {
      console.log('done!', resumeId)
    }
  }, [done, resumeId]);

  useEffect(() => {
    if ((isDetecting || done) && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message)
      window.speechSynthesis.speak(utterance)
    }
  }, [isDetecting, message, done]);

  useEffect(() => {
    const loadModels = async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/models')
      ])
    }
    loadModels()
  }, [])

  const startVideo = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            aspectRatio: { ideal: 1.333 }
          }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.playsInline = true;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setIsDetecting(true)
            setCurrentStep(0)
            setMessage(`Please ${instructions[0].text}`)
          }
        }
      } catch (err) {
        console.error("Error accessing the camera", err)
        setMessage("Camera access denied. Please check your browser settings.")
      }
    }
  }

  const stopVideo = () => {
    const stream = videoRef.current?.srcObject as MediaStream
    const tracks = stream?.getTracks()
    tracks?.forEach(track => track.stop())
  }

  const startDetection = async () => {
    await startVideo()
  }

  useLayoutEffect(() => {
    const width = () => videoRef.current?.videoWidth || videoRef.current?.width || 0;
    const height = () => videoRef.current?.videoHeight || videoRef.current?.height || 0;

    if (!isDetectingDebounced || !isDetecting) return

    if (!videoRef.current || !canvasRef.current || !width() || !height()) return;

    let detecting: boolean = isDetecting;

    const detectFace = async () => {
      console.count('trying to detect face');

      console.log(!!videoRef.current, !!canvasRef.current)
      const video = videoRef.current!
      const canvas = canvasRef.current!
      const displaySize = { width: width(), height: height() }
      faceapi.matchDimensions(canvas, displaySize);

      let i = setInterval(async () => {
        if (!detecting || !videoRef.current || !canvasRef.current) {
          clearInterval(i);
        }

        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions()

        if (detection) {
          const resizedDetection = faceapi.resizeResults(detection, displaySize)
          canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)

          verifyAction(currentStep, resizedDetection)
          console.log("Face detected")
        } else {
          console.log("No face detected")
        }
      }, 100);
    }

    detectFace();

    return () => {
      detecting = false
    }
  }, [isDetectingDebounced, isDetecting, videoRef, canvasRef, videoRef.current?.videoWidth, videoRef.current?.width, currentStep]);

  const stopDetection = () => {
    stopVideo()
    setIsDetecting(false)
    setCurrentStep(0)
  }

  const verifyAction = (step: number, detection: faceapi.WithFaceExpressions<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>>) => {
    const currentInstruction = instructions[currentStep]
    let actionVerified = false

    console.log(currentInstruction.action);

    switch (currentInstruction.action) {
      case 'neutral':
        actionVerified = detection.expressions.neutral > 0.8
        break
      case 'smile':
        actionVerified = detection.expressions.happy > 0.7
        break
    }

    if (actionVerified) {
      if (step < instructions.length - 1) {
        setCurrentStep(step + 1)
        setMessage(`Great! Now ${instructions[currentStep + 1].text}`)
      } else if (step === instructions.length - 1) {
        setMessage("Well done! You've successfully completed the liveness detection.");
        stopDetection()
        setDone(true)
      }
    }
  }

  return (
    <>
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Liveness Detection</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? null : <div className="relative w-full aspect-video max-w-[640px] mx-auto">
            <video ref={videoRef} playsInline autoPlay muted className="rounded-lg shadow-lg absolute top-0 left-0 w-full h-full object-cover z-30" />
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-50" />
          </div>}
          <p className="mt-4 text-center text-lg font-semibold">{message}</p>
          <div className="mt-4 flex justify-center space-x-4">
            {!isDetecting && !done ? (
              <Button onClick={startDetection}>Start</Button>
            ) : (
              <Button onClick={stopDetection} variant="destructive">Stop</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
