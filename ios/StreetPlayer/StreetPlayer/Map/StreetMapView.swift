import CoreLocation
import MapLibre
import SwiftUI

struct StreetMapView: UIViewRepresentable {
    let points: [WalkPoint]
    let center: CLLocationCoordinate2D?
    let gridCells: [GridDisplayCell]
    let capturedSquareIds: Set<String>
    let tentativeSquareIds: Set<String>
    let recenterRequest: Int

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> MLNMapView {
        let styleURL = Bundle.main.url(forResource: "osm-raster-style", withExtension: "json")
            ?? URL(string: "https://demotiles.maplibre.org/style.json")
        let mapView = MLNMapView(frame: .zero, styleURL: styleURL)
        mapView.delegate = context.coordinator
        mapView.logoView.isHidden = true
        mapView.attributionButton.isHidden = false
        mapView.showsUserLocation = true
        mapView.userTrackingMode = .followWithHeading
        mapView.setCenter(CLLocationCoordinate2D(latitude: 54.4065, longitude: 18.5543), zoomLevel: 15, animated: false)
        context.coordinator.mapView = mapView
        return mapView
    }

    func updateUIView(_ mapView: MLNMapView, context: Context) {
        if let center,
           !context.coordinator.didCenterOnUser || context.coordinator.lastRecenterRequest != recenterRequest {
            mapView.setCenter(center, zoomLevel: 16, animated: true)
            context.coordinator.didCenterOnUser = true
            context.coordinator.lastRecenterRequest = recenterRequest
        }
        context.coordinator.updateRoute(points: points)
        context.coordinator.updateGrid(
            cells: gridCells,
            capturedSquareIds: capturedSquareIds,
            tentativeSquareIds: tentativeSquareIds
        )
    }

    final class Coordinator: NSObject, MLNMapViewDelegate {
        weak var mapView: MLNMapView?
        var didCenterOnUser = false
        var lastRecenterRequest = 0

        func mapView(_ mapView: MLNMapView, didFinishLoading style: MLNStyle) {
            ensureGridLayers(style: style)
            ensureRouteLayer(style: style)
        }

        func updateRoute(points: [WalkPoint]) {
            guard let style = mapView?.style else { return }
            ensureRouteLayer(style: style)
            guard let source = style.source(withIdentifier: "recording-route") as? MLNShapeSource else { return }

            var coordinates = points.map {
                CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lon)
            }
            guard coordinates.count >= 2 else {
                source.shape = nil
                return
            }
            let line = MLNPolylineFeature(coordinates: &coordinates, count: UInt(coordinates.count))

            source.shape = line
        }

        func updateGrid(
            cells: [GridDisplayCell],
            capturedSquareIds: Set<String>,
            tentativeSquareIds: Set<String>
        ) {
            guard let style = mapView?.style else { return }
            ensureGridLayers(style: style)
            updatePolygonSource(
                identifier: "street-grid-all",
                cells: cells,
                matching: nil,
                style: style
            )
            updatePolygonSource(
                identifier: "street-grid-captured",
                cells: cells,
                matching: capturedSquareIds,
                style: style
            )
            updatePolygonSource(
                identifier: "street-grid-tentative",
                cells: cells,
                matching: tentativeSquareIds.subtracting(capturedSquareIds),
                style: style
            )
        }

        private func updatePolygonSource(
            identifier: String,
            cells: [GridDisplayCell],
            matching ids: Set<String>?,
            style: MLNStyle
        ) {
            guard let source = style.source(withIdentifier: identifier) as? MLNShapeSource else { return }
            let shapes = cells.compactMap { cell -> MLNShape? in
                if let ids, !ids.contains(cell.id) { return nil }
                var coordinates = cell.polygon
                guard coordinates.count >= 3 else { return nil }
                if let first = coordinates.first,
                   let last = coordinates.last,
                   first.latitude != last.latitude || first.longitude != last.longitude {
                    coordinates.append(first)
                }
                guard coordinates.count >= 4 else { return nil }
                return MLNPolygonFeature(coordinates: &coordinates, count: UInt(coordinates.count))
            }

            source.shape = shapes.isEmpty ? nil : MLNShapeCollectionFeature(shapes: shapes)
        }

        private func ensureGridLayers(style: MLNStyle) {
            ensureFillLayer(
                sourceIdentifier: "street-grid-all",
                layerIdentifier: "street-grid-all-fill",
                color: UIColor.systemRed,
                opacity: 0.16,
                outlineColor: UIColor.systemRed,
                style: style
            )
            ensureFillLayer(
                sourceIdentifier: "street-grid-captured",
                layerIdentifier: "street-grid-captured-fill",
                color: UIColor.systemGreen,
                opacity: 0.34,
                outlineColor: UIColor.systemGreen,
                style: style
            )
            ensureFillLayer(
                sourceIdentifier: "street-grid-tentative",
                layerIdentifier: "street-grid-tentative-fill",
                color: UIColor.systemGreen,
                opacity: 0.42,
                outlineColor: UIColor.systemGreen,
                style: style
            )
        }

        private func ensureFillLayer(
            sourceIdentifier: String,
            layerIdentifier: String,
            color: UIColor,
            opacity: Double,
            outlineColor: UIColor,
            style: MLNStyle
        ) {
            if style.source(withIdentifier: sourceIdentifier) == nil {
                style.addSource(MLNShapeSource(identifier: sourceIdentifier, shape: nil, options: nil))
            }

            if style.layer(withIdentifier: layerIdentifier) == nil,
               let source = style.source(withIdentifier: sourceIdentifier) {
                let layer = MLNFillStyleLayer(identifier: layerIdentifier, source: source)
                layer.fillColor = NSExpression(forConstantValue: color)
                layer.fillOpacity = NSExpression(forConstantValue: opacity)
                layer.fillOutlineColor = NSExpression(forConstantValue: outlineColor.withAlphaComponent(0.95))
                style.addLayer(layer)
            }
        }

        private func ensureRouteLayer(style: MLNStyle) {
            if style.source(withIdentifier: "recording-route") == nil {
                let source = MLNShapeSource(
                    identifier: "recording-route",
                    shape: nil,
                    options: nil
                )
                style.addSource(source)
            }

            if style.layer(withIdentifier: "recording-route-casing") == nil,
               let source = style.source(withIdentifier: "recording-route") {
                let layer = MLNLineStyleLayer(identifier: "recording-route-casing", source: source)
                layer.lineCap = NSExpression(forConstantValue: NSValue(mlnLineCap: .round))
                layer.lineJoin = NSExpression(forConstantValue: NSValue(mlnLineJoin: .round))
                layer.lineColor = NSExpression(forConstantValue: UIColor.white)
                layer.lineWidth = NSExpression(forConstantValue: 10)
                layer.lineOpacity = NSExpression(forConstantValue: 0.9)
                style.addLayer(layer)
            }

            if style.layer(withIdentifier: "recording-route-line") == nil,
               let source = style.source(withIdentifier: "recording-route") {
                let layer = MLNLineStyleLayer(identifier: "recording-route-line", source: source)
                layer.lineCap = NSExpression(forConstantValue: NSValue(mlnLineCap: .round))
                layer.lineJoin = NSExpression(forConstantValue: NSValue(mlnLineJoin: .round))
                layer.lineColor = NSExpression(forConstantValue: UIColor.systemBlue)
                layer.lineWidth = NSExpression(forConstantValue: 6)
                layer.lineOpacity = NSExpression(forConstantValue: 1)
                style.addLayer(layer)
            }
        }
    }
}
